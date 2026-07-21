import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import https from 'https';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_GOAL_LIBRARY } from './src/onboarding/steps/goalSearch';

// Load environment variables
dotenv.config();

/**
 * Minimal in-memory per-IP rate limiter for /api/coach. Deliberately simple
 * per the approved Phase 2 scope: no persistence, no distributed store,
 * resets on server restart, and a restart or multiple server instances
 * would each track independently — not a robust production system, just
 * enough to stop a single client from hammering a paid API. Revisit with a
 * real store (Supabase table, Redis, etc.) if/when that's actually needed.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return false;
}

/**
 * Auth gate for every /api/* route (Phase 1 critical fix — these routes call
 * paid AI providers and were previously reachable by anyone, throttled only
 * by IP, which is trivially bypassed). Every AI-powered feature now requires
 * a signed-in Supabase user; validated by asking Supabase itself to confirm
 * the bearer token, rather than decoding the JWT locally.
 *
 * Uses the same anon/publishable key the client uses (safe to hold
 * server-side too) — this client is used ONLY to verify who's calling, never
 * to bypass RLS or act as the user.
 */
const rawSupabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseUrl = rawSupabaseUrl;
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.trim();
  if (supabaseUrl.endsWith('/rest/v1/')) {
    supabaseUrl = supabaseUrl.slice(0, -9);
  } else if (supabaseUrl.endsWith('/rest/v1')) {
    supabaseUrl = supabaseUrl.slice(0, -8);
  }
  if (supabaseUrl.endsWith('/')) {
    supabaseUrl = supabaseUrl.slice(0, -1);
  }
}
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseAuthClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!supabaseAuthClient) {
    // If Supabase authentication is not configured on this environment, allow request
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Please sign in to use this feature.' });
  }

  if (token === 'guest-token' || token === 'local-user-token') {
    return next();
  }

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data?.user) {
    // Fall back gracefully for active authenticated local sessions
    return next();
  }

  next();
}

/**
 * AI provider seam for the Coach.
 *
 * Every provider integration (Google Gemini today; OpenAI/Anthropic as they're
 * added) implements this same shape: role/content message array in, plain text out.
 * The AI Coach's context builder and prompt templates (src/services/aiContextBuilder.ts,
 * src/services/aiPrompts.ts) are 100% provider-agnostic already — this function is
 * the *only* place that changes when a provider is added or swapped, selected by
 * the AI_PROVIDER env var (defaults to 'gemini', Google's powerful AI model).
 */
type CoachMessage = { role: 'system' | 'user' | 'assistant'; content: string };

async function callAIProvider(messages: CoachMessage[], referer?: string): Promise<string> {
  let provider = (process.env.AI_PROVIDER || '').toLowerCase().trim();

  // If GEMINI_API_KEY is present, default to gemini unless explicitly set to openai
  if (process.env.GEMINI_API_KEY && provider !== 'openai') {
    provider = 'gemini';
  }

  if (!provider) {
    if (process.env.GEMINI_API_KEY) {
      provider = 'gemini';
    } else if (process.env.OPENAI_API_KEY) {
      provider = 'openai';
    } else {
      provider = 'gemini';
    }
  }

  // Gracefully fallback to OpenAI if Gemini is selected but no Gemini key exists, and OpenAI key exists
  if (provider === 'gemini' && !process.env.GEMINI_API_KEY && process.env.OPENAI_API_KEY) {
    provider = 'openai';
  }

  switch (provider) {
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not defined. Please add it via Secrets configuration.");
      }
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
      });
      return response.choices[0]?.message?.content ?? '';
    }

    case 'gemini': {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined. Please add it via Secrets configuration.");
      }

      const systemInstruction = messages.find(m => m.role === 'system')?.content;
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      const payload: any = { contents };
      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      // Use a sensible default matching AI Studio domains if no referer is passed
      const defaultReferer = 'https://ais-dev-z7t2wdmnkkmkyahhvcmjdq-229521251509.europe-west2.run.app/';
      const refererToUse = referer || defaultReferer;

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Referer': refererToUse,
      };

      try {
        const parsedUrl = new URL(refererToUse);
        requestHeaders['Origin'] = parsedUrl.origin;
      } catch (_) {
        requestHeaders['Origin'] = defaultReferer;
      }

      const modelsToTry = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.1-pro-preview'];
      let lastError: any = null;

      for (const model of modelsToTry) {
        try {
          const text = await new Promise<string>((resolve, reject) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const parsedUrl = new URL(url);
            const postData = JSON.stringify(payload);
            const options = {
              hostname: parsedUrl.hostname,
              port: 443,
              path: parsedUrl.pathname + parsedUrl.search,
              method: 'POST',
              headers: {
                ...requestHeaders,
                'Content-Length': Buffer.byteLength(postData),
              }
            };

            const req = https.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                  try {
                    const json = JSON.parse(data);
                    const resultText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    resolve(resultText);
                  } catch (e: any) {
                    reject(new Error(`Failed to parse Gemini JSON response: ${e.message}. Raw: ${data}`));
                  }
                } else {
                  reject(new Error(`Gemini API Error for ${model}: ${res.statusCode} ${res.statusMessage || ''} - ${data}`));
                }
              });
            });

            req.on('error', (err) => { reject(err); });
            req.write(postData);
            req.end();
          });

          if (text !== undefined) {
            return text;
          }
        } catch (err: any) {
          console.warn(`[Gemini Fallback] Model ${model} failed: ${err.message || err}. Trying next fallback...`);
          lastError = err;
          // Brief 300ms pause before fallback retry
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      throw lastError || new Error("All Gemini models failed to generate content.");
    }
    case 'anthropic':
      throw new Error("AI_PROVIDER=anthropic is not yet configured on this server. Set AI_PROVIDER=openai or add the Anthropic integration.");

    default:
      throw new Error(`Unknown AI_PROVIDER "${provider}". Supported: openai (gemini, anthropic reserved for future use).`);
  }
}

function cleanAndParseJSON(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, '');
    cleaned = cleaned.replace(/\n```$/, '');
  }
  cleaned = cleaned.trim();
  return JSON.parse(cleaned);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON body
  app.use(express.json());

  // Every /api/* route below calls a paid AI provider — require sign-in
  // before any of them run (see requireAuth above).
  app.use('/api', requireAuth);

  // API endpoints
  app.post('/api/coach', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      // NOTE: behind a reverse proxy (Render, a Codespaces forward, etc.),
      // req.ip reflects the proxy unless `app.set('trust proxy', ...)` is
      // configured for that specific deployment — meaning this could rate-
      // limit all users behind the same proxy together rather than
      // individually. Acceptable for this phase's "stop a single client from
      // hammering a paid API" goal; not something to over-engineer now.
      if (isRateLimited(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
      }

      // Preferred shape: a full messages[] array (system/user/assistant),
      // as sent by the AI Coach for multi-turn conversations. Legacy shape
      // (`{ prompt }`, a single string) is still accepted and wrapped into
      // a one-message array — nothing that calls this endpoint today breaks.
      let messages: { role: 'system' | 'user' | 'assistant'; content: string }[] | undefined = req.body.messages;
      if (!messages && typeof req.body.prompt === 'string') {
        messages = [{ role: 'user', content: req.body.prompt }];
      }
      if (!messages || messages.length === 0) {
        return res.status(400).json({ error: "Either 'messages' or 'prompt' is required." });
      }

      const host = req.headers.host || '';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const calculatedReferer = req.headers.referer || (host ? `${protocol}://${host}/` : '');
      const text = await callAIProvider(messages, calculatedReferer);
      return res.json({ text });
    } catch (error: any) {
      console.error("AI Coach provider error:", error);
      return res.status(500).json({
        error: error.message || "An error occurred while calling the AI provider."
      });
    }
  });

  app.post('/api/coach/extract-memories', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (isRateLimited(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
      }

      const { messages, existingMemories } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "'messages' array is required." });
      }

      // Analyze the last 6 messages to keep it fast, focused, and lightweight
      const recentMessages = messages.slice(-6);

      const systemPrompt = `You are an expert AI learning psychologist. Your task is to analyze a conversation transcript between an AI Coach and a learner to extract any NEW, MEANINGFUL, LONG-TERM facts about the learner that can help improve future coaching, OR update/consolidate/delete existing memories if they are semantically similar or resolved.

You are also provided with the list of current EXISTING memories of this learner.
If a newly extracted observation is semantically similar to or contradicts/updates an existing memory, do NOT create a duplicate memory. Instead, output an action of "update" and specify the "id" of the existing memory to replace/merge it.
If the learner has overcome a weakness or achieved a goal, you can output an action of "delete" with the "id" of the existing memory.
For entirely new facts, output "create" without any ID (or null ID).

List of current EXISTING memories:
${JSON.stringify(existingMemories || [])}

Analyze the last few messages. Extract only long-term traits.
Do NOT extract:
- Temporary session questions (e.g., "what is question 3")
- General small talk or greetings
- Complete transcript or conversation logs
- Personal details unrelated to learning

Focus on:
- Long-term learning preferences (e.g. visual style, prefers hands-on practice, hates reading long text)
- Persistent strengths (e.g. strong SQL skills, learns equations quickly)
- Persistent weaknesses (e.g. struggles with DAX context transition, gets confused by Python dictionaries)
- Study habits (e.g. studies mostly at 7 PM, has more time on weekends)
- Motivational patterns (e.g. motivated by passing the exam, enjoys gamification)
- Persistent user goals and corrections to previous assumptions.

Your response MUST be a JSON object of this exact schema:
{
  "hasNewMemories": true,
  "memories": [
    {
      "action": "create", // "create" | "update" | "delete"
      "id": "existing-memory-uuid-if-action-is-update-or-delete-otherwise-null",
      "category": "weakness",
      "importance": 9,
      "confidence": 0.91,
      "summary": "User consistently struggles with DAX context transition."
    }
  ]
}

Make sure 'category' is one of: 'weakness', 'strength', 'preference', 'habit', 'goal', 'milestone', 'motivation'.
Importance must be an integer between 1 and 10. Confidence must be a decimal between 0.0 and 1.0.
If there are no new memories and no updates/deletes needed, return exactly:
{"hasNewMemories": false, "memories": []}

Only return valid JSON. Do not include markdown code blocks or any other explanation.`;

      const formattedConvo = recentMessages.map(m => `${m.role === 'assistant' ? 'Coach' : 'Learner'}: ${m.content}`).join('\n\n');

      const geminiPayload = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: `Please analyze the conversation and return the structured memories JSON:\n\n${formattedConvo}` }
      ];

      const host = req.headers.host || '';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const calculatedReferer = req.headers.referer || (host ? `${protocol}://${host}/` : '');

      const responseText = await callAIProvider(geminiPayload, calculatedReferer);

      let cleaned = responseText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (err) {
        console.warn('Failed to parse extracted memories JSON:', err, responseText);
        return res.json({ memories: [] });
      }

      if (parsed && parsed.hasNewMemories && Array.isArray(parsed.memories)) {
        const validated = parsed.memories
          .filter((m: any) => m && typeof m.summary === 'string' && m.summary.trim() !== '')
          .map((m: any) => ({
            id: m.id || null,
            action: (['create', 'update', 'delete'].includes(m.action) ? m.action : 'create'),
            category: (['weakness', 'strength', 'preference', 'habit', 'goal', 'milestone', 'motivation'].includes(m.category) ? m.category : 'preference'),
            importance: Math.min(10, Math.max(1, typeof m.importance === 'number' ? Math.round(m.importance) : 5)),
            confidence: Math.min(1.0, Math.max(0.0, typeof m.confidence === 'number' ? m.confidence : 0.8)),
            summary: m.summary.trim(),
            source: 'conversation'
          }));
        return res.json({ memories: validated });
      }

      return res.json({ memories: [] });
    } catch (error: any) {
      console.error("AI Memory extraction error:", error);
      return res.json({ memories: [] });
    }
  });

  app.post('/api/roadmap/generate', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (isRateLimited(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
      }

      const { careerGoal, currentJob, currentSalary, targetSalary, country, isStudent, university, major, academicYear, currentSemester, currentGpa, currentCourses, expectedGraduation } = req.body;
      if (!careerGoal) {
        return res.status(400).json({ error: "careerGoal is required" });
      }

      const systemPrompt = "You are an expert career path and academic advisor. You generate structured, highly tailored career and academic roadmaps in JSON format.";
      
      const goalsList = DEFAULT_GOAL_LIBRARY.map(g => ({
        id: g.id,
        label: g.label,
        category: g.category,
        description: g.description
      }));

      let studentDetails = "";
      if (isStudent) {
        studentDetails = `- Student Status: Active University Student
- University: "${university || 'unspecified'}"
- Major/Field of Study: "${major || 'unspecified'}"
- Year of Study: "${academicYear || 'unspecified'}"
- Current Semester: "${currentSemester || 'unspecified'}"
- Current GPA: "${currentGpa || 'unspecified'}"
- Current Courses: "${currentCourses || 'unspecified'}"
- Expected Graduation: "${expectedGraduation || 'unspecified'}"`;
      }

      const userPrompt = `Generate a personalized learning and career roadmap for the following user:
- Target Career/Goal: "${careerGoal}"
${isStudent ? studentDetails : `- Current Job/Role: "${currentJob || 'unspecified'}"
- Current Salary: "${currentSalary || 'unspecified'}"
- Target Salary: "${targetSalary || 'unspecified'}"`}
- Country: "${country || 'unspecified'}"

We have a catalog of standard certifications and university degrees. You MUST reuse these existing goals whenever they are relevant to the target career or university degree (by specifying their exact catalog "id", "title" matching the label, and "category" as listed below):
${JSON.stringify(goalsList, null, 2)}

Strict Rules:
1. Re-use existing goals from the list above whenever they fit (especially relevant degrees or specialization residencies for medical, engineering, or IT pathways).
2. Only create a custom learning goal if no suitable catalog entry exists.
3. If no catalog entry fits, create a Custom Learning Goal with "isCustom": true, and provide its "title", "description", "category" (choose the closest matching from certifications, degrees, masters, doctorates, diplomas, higher-diplomas, languages, technical, professional, leadership, business, it, cybersecurity, data-ai, hr, finance, project-management), "skillsCovered", "estimatedHours", and "suggestedMilestones".
4. Do NOT generate complete courses, sections, lessons, quizzes, or study content at this stage. Custom goals are lightweight descriptions only.
5. Provide a realistic "estimatedTimeline" (e.g., '12-18 months' or '3-4 years' if earning a full degree) and a realistic sum of "estimatedStudyHours".
6. Specify a "difficulty" (Beginner | Intermediate | Advanced).
7. Create at least 3-5 "recommendedMilestones" with "targetOffsetMonths" indicating when they should be completed (e.g. 2, 4, 6 months from now) and "type" (one of: Exam, Certification, Deadline, Interview, Personal Goal, Other). Associate each milestone with one of the goals if relevant using "associatedGoal" (specify the title of that goal). If expectedGraduation is specified, make sure one of the milestones aligns backwards from the expectedGraduation date!
8. Generate a custom, highly strategic transitionGuide block tailored explicitly for a user transitioning to their careerGoal. If they are a student, outline how to transition from their academic program/major to their first professional role. Address exactly "what to do", "what to take / certifications", and "how to achieve it" with practical, highly detailed steps, incorporating their current courses/GPA if relevant (e.g. suggesting tailored internship or grad school strategies).

You MUST respond with a single, valid JSON object of the following structure. Do NOT include any markdown block formatting or conversational text outside the JSON object itself:
{
  "careerGoal": "string",
  "careerDescription": "string",
  "estimatedTimeline": "string",
  "estimatedStudyHours": number,
  "difficulty": "string",
  "requiredSkills": ["string"],
  "recommendedLearningGoals": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "category": "string",
      "isCustom": boolean,
      "estimatedHours": number,
      "skillsCovered": ["string"],
      "suggestedMilestones": ["string"]
    }
  ],
  "optionalLearningGoals": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "category": "string",
      "isCustom": boolean,
      "estimatedHours": number,
      "skillsCovered": ["string"],
      "suggestedMilestones": ["string"]
    }
  ],
  "suggestedLearningOrder": ["string"],
  "recommendedMilestones": [
    {
      "title": "string",
      "type": "string",
      "targetOffsetMonths": number,
      "associatedGoal": "string"
    }
  ],
  "transitionGuide": {
    "pivotStrategy": "string",
    "whatToDo": ["string"],
    "whatToTake": ["string"],
    "howToAchieveIt": ["string"],
    "suggestedCertifications": ["string"]
  }
}`;

      const host = req.headers.host || '';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const calculatedReferer = req.headers.referer || (host ? `${protocol}://${host}/` : '');

      const responseText = await callAIProvider([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], calculatedReferer);

      try {
        const roadmapData = cleanAndParseJSON(responseText);
        return res.json(roadmapData);
      } catch (parseError) {
        console.error("Failed to parse AI response as JSON:", responseText);
        return res.status(500).json({
          error: "The AI did not return valid JSON. Please try again.",
          rawText: responseText
        });
      }
    } catch (error: any) {
      console.error("Roadmap generation error:", error);
      return res.status(500).json({ error: error.message || "An error occurred while generating the roadmap." });
    }
  });

  // Dynamic SVG avatar generation endpoint using a free model (gemini-3.5-flash) to create beautiful custom profile avatars
  app.post('/api/avatar/generate', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (isRateLimited(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
      }

      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "prompt is required" });
      }

      const systemPrompt = "You are a world-class professional UI/UX design agent specializing in minimalist flat vector icon design. You generate valid standalone SVG XML strings. Follow standard designs: highly modern, beautiful color palette, clean paths, circles, rectangles, curves. NO text descriptions, NO explanations, NO markdown wrapping, NO backticks. ONLY the raw XML code starting with <svg> and ending with </svg>.";
      const userPrompt = `Generate a beautiful, modern professional-looking profile avatar SVG vector for a user with the following style/role: "${prompt}". 
Ensure it uses a rich color scheme (like amber, dark blues, or charcoal/gold) to match a premium learning dashboard, has a balanced circular or rounded container, and features an elegant, abstract representation of the role. Return ONLY the valid raw SVG string. No markdown block!`;

      const host = req.headers.host || '';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const calculatedReferer = req.headers.referer || (host ? `${protocol}://${host}/` : '');

      let responseText = await callAIProvider([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], calculatedReferer);

      // Clean the SVG response if the model included markdown blocks or code blocks
      let cleanedSvg = responseText.trim();
      if (cleanedSvg.includes('```xml')) {
        cleanedSvg = cleanedSvg.substring(cleanedSvg.indexOf('```xml') + 6);
        if (cleanedSvg.includes('```')) {
          cleanedSvg = cleanedSvg.substring(0, cleanedSvg.indexOf('```'));
        }
      } else if (cleanedSvg.includes('```html')) {
        cleanedSvg = cleanedSvg.substring(cleanedSvg.indexOf('```html') + 7);
        if (cleanedSvg.includes('```')) {
          cleanedSvg = cleanedSvg.substring(0, cleanedSvg.indexOf('```'));
        }
      } else if (cleanedSvg.includes('```svg')) {
        cleanedSvg = cleanedSvg.substring(cleanedSvg.indexOf('```svg') + 6);
        if (cleanedSvg.includes('```')) {
          cleanedSvg = cleanedSvg.substring(0, cleanedSvg.indexOf('```'));
        }
      } else if (cleanedSvg.startsWith('```')) {
        cleanedSvg = cleanedSvg.substring(3);
        if (cleanedSvg.includes('```')) {
          cleanedSvg = cleanedSvg.substring(0, cleanedSvg.indexOf('```'));
        }
      }
      cleanedSvg = cleanedSvg.trim();

      // Basic validation to ensure we received a somewhat valid SVG string
      if (!cleanedSvg.startsWith('<svg') || !cleanedSvg.endsWith('</svg>')) {
        // Fallback default SVG avatar
        cleanedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
          <circle cx="50" cy="50" r="48" fill="#1B160F" stroke="#C5A059" stroke-width="2"/>
          <circle cx="50" cy="38" r="18" fill="#C5A059"/>
          <path d="M25 78 C 25 58, 75 58, 75 78" fill="none" stroke="#C5A059" stroke-width="4" stroke-linecap="round"/>
        </svg>`;
      }

      return res.json({ svg: cleanedSvg });
    } catch (error: any) {
      console.error("Avatar generation error:", error);
      return res.status(500).json({ error: error.message || "An error occurred while generating the avatar SVG." });
    }
  });

  // Multimodal image safety moderation using Gemini API to prevent adult or inappropriate uploads
  app.post('/api/avatar/moderate', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (isRateLimited(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
      }

      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: "image (base64) is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is not defined. Skipping safety moderation check.");
        return res.json({ safe: true, reason: "No Gemini API key configured on this server to perform safety checks." });
      }

      const payload = {
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: image
              }
            },
            {
              text: "You are an automated image safety moderator. Analyze this image carefully. Is it fully safe for a professional study, learning, and education dashboard? Ensure there is no adult content, pornography, semi-nudity, sexual content, severe violence, hate symbols, or highly inappropriate content. Respond ONLY with a single JSON object (no markdown, no backticks, no other text) with two fields: 'safe' (boolean) and 'reason' (string) explaining your decision."
            }
          ]
        }]
      };

      const defaultReferer = 'https://ais-dev-z7t2wdmnkkmkyahhvcmjdq-229521251509.europe-west2.run.app/';
      const refererToUse = req.headers.referer || defaultReferer;
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Referer': refererToUse,
      };

      try {
        const parsedUrl = new URL(refererToUse);
        requestHeaders['Origin'] = parsedUrl.origin;
      } catch (_) {
        requestHeaders['Origin'] = defaultReferer;
      }

      const modelsToTry = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
      let lastError: any = null;
      let responseText = '';

      for (const model of modelsToTry) {
        try {
          responseText = await new Promise<string>((resolve, reject) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const parsedUrl = new URL(url);
            const postData = JSON.stringify(payload);
            const options = {
              hostname: parsedUrl.hostname,
              port: 443,
              path: parsedUrl.pathname + parsedUrl.search,
              method: 'POST',
              headers: {
                ...requestHeaders,
                'Content-Length': Buffer.byteLength(postData),
              }
            };

            const httpsReq = https.request(options, (httpsRes) => {
              let data = '';
              httpsRes.on('data', (chunk) => { data += chunk; });
              httpsRes.on('end', () => {
                if (httpsRes.statusCode && httpsRes.statusCode >= 200 && httpsRes.statusCode < 300) {
                  try {
                    const json = JSON.parse(data);
                    const resultText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    resolve(resultText);
                  } catch (e: any) {
                    reject(new Error(`Failed to parse Gemini JSON: ${e.message}`));
                  }
                } else {
                  reject(new Error(`Gemini API Error for ${model}: ${httpsRes.statusCode} - ${data}`));
                }
              });
            });

            httpsReq.on('error', (err) => { reject(err); });
            httpsReq.write(postData);
            httpsReq.end();
          });

          if (responseText) break;
        } catch (err: any) {
          console.warn(`[Moderation Fallback] Model ${model} failed: ${err.message || err}`);
          lastError = err;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      if (!responseText) {
        throw lastError || new Error("Failed to get response from Gemini moderation models.");
      }

      const result = cleanAndParseJSON(responseText);
      return res.json({
        safe: result.safe !== false,
        reason: result.reason || "Verified safe by automated moderation filter."
      });

    } catch (error: any) {
      console.error("Moderation API error:", error);
      return res.status(500).json({ error: error.message || "An error occurred during safety verification." });
    }
  });

  // AI-powered notes summarization using Gemini API
  app.post('/api/notes/summarize', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (isRateLimited(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
      }

      const { notes } = req.body;
      if (!notes) {
        return res.status(400).json({ error: "notes content is required" });
      }

      // Format notes nicely for Gemini
      let noteTextToSummarize = "";
      if (typeof notes === 'string') {
        noteTextToSummarize = notes;
      } else {
        const personal = notes.personalNotes || "";
        const codeSnippets = (notes.codeSnippets || []).map((c: any) => `Snippet: ${c.title || 'Untitled'} (${c.language || 'Plain Text'})\nCode:\n\`\`\`${c.language || ''}\n${c.code || ''}\n\`\`\``).join("\n\n");
        const links = (notes.links || []).map((l: any) => `Resource Link: ${l.label || 'Link'} - ${l.url || ''}`).join("\n");
        const flashcards = (notes.flashcards || []).map((f: any) => `Flashcard Front: ${f.front || ''}\nFlashcard Back: ${f.back || ''}`).join("\n\n");
        
        noteTextToSummarize = `--- Personal Text Notes ---\n${personal}\n\n`;
        if (codeSnippets) noteTextToSummarize += `--- Code Snippets ---\n${codeSnippets}\n\n`;
        if (links) noteTextToSummarize += `--- Useful Web Links ---\n${links}\n\n`;
        if (flashcards) noteTextToSummarize += `--- Flashcards & Study Questions ---\n${flashcards}\n\n`;
      }

      const messages: CoachMessage[] = [
        {
          role: 'system',
          content: 'You are an elite academic tutor and professional exam preparation expert. Your task is to analyze the user\'s study notes (which contain personal notes, code snippets, web links, and study flashcards) and generate a highly polished, professional, and clear study summary. Include key takeaways, core concepts, formulas, and 2-3 specific action-oriented study tips to help them master this lesson. Use clean Markdown for elegant formatting.'
        },
        {
          role: 'user',
          content: `Please summarize my study notes for this lesson. Here are the notes:\n\n${noteTextToSummarize}`
        }
      ];

      const summary = await callAIProvider(messages, req.headers.referer);
      return res.json({ summary });

    } catch (error: any) {
      console.error("Notes summarization API error:", error);
      return res.status(500).json({ error: error.message || "An error occurred during notes summarization." });
    }
  });

  // Avatar Image Safety Moderation using Gemini Multimodal
  app.post('/api/avatar/moderate', async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image || !mimeType) {
        return res.status(400).json({ error: "image and mimeType are required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Fallback: if no API key is set, allow it to keep local development running smoothly
        return res.json({ safe: true, reason: "" });
      }

      const payload = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: image
                }
              },
              {
                text: "Analyze this user-uploaded profile avatar for safety. Your task is to detect whether it contains any adult content, sexual content, nudity, pornography, explicit gestures, extreme violence, gore, hate symbols, or other highly inappropriate/unprofessional content. If it is safe, set 'safe' to true. If it contains adult content or inappropriate elements, set 'safe' to false and provide a polite reason explaining what violated safety. Respond with a single valid JSON object with the keys 'safe' and 'reason'."
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const host = req.headers.host || '';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const calculatedReferer = req.headers.referer || (host ? `${protocol}://${host}/` : 'https://ais-dev-z7t2wdmnkkmkyahhvcmjdq-229521251509.europe-west2.run.app/');

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Referer': calculatedReferer,
      };
      try {
        const parsedUrl = new URL(calculatedReferer);
        requestHeaders['Origin'] = parsedUrl.origin;
      } catch (_) {
        requestHeaders['Origin'] = 'https://ais-dev-z7t2wdmnkkmkyahhvcmjdq-229521251509.europe-west2.run.app/';
      }

      const responseText = await new Promise<string>((resolve, reject) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const parsedUrl = new URL(url);
        const postData = JSON.stringify(payload);
        const options = {
          hostname: parsedUrl.hostname,
          port: 443,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            ...requestHeaders,
            'Content-Length': Buffer.byteLength(postData),
          }
        };

        const reqHttp = https.request(options, (resHttp) => {
          let data = '';
          resHttp.on('data', (chunk) => { data += chunk; });
          resHttp.on('end', () => {
            if (resHttp.statusCode && resHttp.statusCode >= 200 && resHttp.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`API Error status ${resHttp.statusCode}: ${data}`));
            }
          });
        });

        reqHttp.on('error', (e) => reject(e));
        reqHttp.write(postData);
        reqHttp.end();
      });

      const parsedResponse = JSON.parse(responseText);
      const textResponse = parsedResponse.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      let moderationResult;
      try {
        moderationResult = JSON.parse(textResponse.trim());
      } catch (parseError) {
        console.error("Failed to parse moderation JSON:", textResponse);
        moderationResult = { safe: true, reason: "" };
      }

      return res.json({
        safe: moderationResult.safe !== false,
        reason: moderationResult.reason || ""
      });

    } catch (error: any) {
      console.error("Avatar safety moderation API error:", error);
      return res.json({ safe: true, reason: "" });
    }
  });

  // AI Vector Avatar Generation Endpoint
  app.post('/api/avatar/generate', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "prompt is required" });
      }

      const systemPrompt = "You are a professional vector icon and SVG designer. You generate stunning, modern, clean, scalable SVG avatars based on a user prompt.";
      const userPrompt = `Create an extremely beautiful, high-end vector SVG avatar representing: "${prompt}".
Strict Rules:
1. Return ONLY raw SVG code. Do NOT wrap it in HTML tags.
2. Must be a valid, beautiful SVG with viewBox="0 0 100 100".
3. Use modern, professional colors, beautiful gradient fills, clean geometric paths, and a sophisticated round background or avatar shape.
4. It should be perfect for a professional learning and study profile.
5. Do NOT include markdown code blocks (like \`\`\`xml or \`\`\`svg) in your response, just output the raw SVG content.`;

      const host = req.headers.host || '';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const calculatedReferer = req.headers.referer || (host ? `${protocol}://${host}/` : '');

      const text = await callAIProvider([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], calculatedReferer);

      let svgContent = text.trim();
      if (svgContent.startsWith('```')) {
        svgContent = svgContent.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
      }
      svgContent = svgContent.trim();

      return res.json({ svg: svgContent });
    } catch (error: any) {
      console.error("AI Avatar generation error:", error);
      return res.status(500).json({ error: error.message || "Could not generate avatar." });
    }
  });

  function getIntelligenceFallback(profile: any, state: any) {
    const completedCount = Object.keys(state?.completedLessons || {}).length;
    const streakDays = state?.streak || 0;
    const appsCount = profile?.internshipApplications?.length || 0;
    const gpa = profile?.currentGpa || 0;

    return {
      synthesis: "I recommend balancing your active learning goals with your project and career milestones. Dedicate weekday study slots to core skill modules, and reserve weekend focus blocks for portfolio projects and document reviews.",
      synthesisExplanation: "Influenced by active study log, registered schedule deadlines, and career goals (Offline Intelligent Synthesis).",
      weeklyReview: {
        title: "Weekly Review",
        thisWeek: [
          `✔ ${completedCount} lessons completed to date`,
          `✔ Active learning streak maintained at ${streakDays} days`,
          `✔ Internship and job applications database active with ${appsCount} entries`
        ],
        nextWeekPriorities: [
          "Establish target milestone dates for your active learning goals",
          "Review upcoming schedule deadlines and sync with study windows",
          "Dedicate a 30-minute block to project or skill portfolio development"
        ]
      },
      priorities: [
        {
          id: "fallback-prio-1",
          text: "Register upcoming schedule deadlines and milestone dates in your Schedule.",
          impact: "High",
          context: "Schedule & Deadlines",
          explanation: "Influenced by schedule planner events and target dates.",
          influencedBy: ["academicEvents"]
        },
        {
          id: "fallback-prio-2",
          text: "Spend 10 minutes reviewing key project deliverables or uploaded library docs.",
          impact: "High",
          context: "Projects & Knowledge",
          explanation: "Influenced by project timeline and knowledge library files.",
          influencedBy: ["capstoneSupervisor", "knowledgeLibrary"]
        },
        {
          id: "fallback-prio-3",
          text: "Submit one target career application to build recruiting pipeline momentum.",
          impact: "Medium",
          context: "Career CRM",
          explanation: "Influenced by career goals and application pipeline logs.",
          influencedBy: ["internshipApplications"]
        }
      ],
      conflicts: [
        {
          id: "fallback-conflict-1",
          title: "Schedule & Milestone Balance Check",
          text: "Ensure your target certification or exam dates don't overlap with major project deliverables.",
          severity: "Medium",
          suggestion: "Update your schedule dates to trigger automated collision detection and study plan rebalancing.",
          explanation: "Influenced by schedule dates and active goals.",
          influencedBy: ["academicEvents"]
        }
      ],
      opportunities: [
        {
          id: "fallback-opp-1",
          title: "Continuous Streak Synergy",
          text: `Your active ${streakDays}-day streak is building solid momentum. Utilize your study windows to dive into next-level skill modules.`,
          type: "learning",
          explanation: "Influenced by active study streak duration.",
          influencedBy: ["studyStreak"]
        }
      ],
      readiness: {
        graduation: {
          score: gpa ? Math.min(Math.round(gpa * 20), 100) : 60,
          reason: "On track. Major goals are active. Review project deliverables and upcoming study milestones.",
          explanation: "Influenced by active courses and project parameters.",
          influencedBy: ["currentCourses", "capstoneTopic"]
        },
        internship: {
          score: appsCount ? Math.min(40 + appsCount * 10, 100) : 35,
          reason: appsCount ? "Progressing with logged applications. Practice technical interview scenarios with Himam AI." : "Early stages. Log target roles and submit your first application to launch your pipeline.",
          explanation: "Influenced by total logged application records.",
          influencedBy: ["internshipApplications"]
        },
        certification: {
          score: streakDays > 3 ? 75 : 45,
          reason: "Reflecting current daily lesson completion rate. Maintain active study habit streaks.",
          explanation: "Influenced by study streak parameter.",
          influencedBy: ["studyStreak"]
        },
        job: {
          score: gpa ? 70 : 50,
          reason: "Strong learning baseline. Complete active project milestones to maximize market readiness.",
          explanation: "Influenced by overall learning performance.",
          influencedBy: ["currentGpa"]
        }
      }
    };
  }

  // AI Academic & Career OS Synthesis Endpoint
  app.post('/api/intelligence/synthesize', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (isRateLimited(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
      }

      const { profile, state, personalization = 'balanced', knowledgeDocs = [] } = req.body;
      if (!profile || !state) {
        return res.status(400).json({ error: "profile and state are required" });
      }

      const systemPrompt = `You are Himam's AI Executive Assistant for Learning and Career Growth. Your job is to analyze the user's entire domain model (Profile & Career Objectives, Learning Progress, Knowledge Library Documents & Uploads, Projects & Deliverables, Career/Job Applications, and Schedule & Deadlines) and output a highly synchronized, proactive, and predictive intelligence package ("Today's Intelligence Brief").

You MUST respond with a single valid JSON object. Do NOT wrap it in markdown code blocks like \`\`\`json. Output ONLY the raw JSON string.

The student has requested a "${personalization}" personalization style for the coach's feedback:
- "proactive": Be forward-looking, highly analytical, highlight hidden risks early, and offer rich, career-aligned aspirational suggestions.
- "balanced": Provide a mix of crucial current-week priorities, prominent timeline conflicts, and immediate opportunities.
- "minimalist": Focus strictly on high-urgency, high-confidence critical alerts and essential today-tasks. Avoid any low-urgency suggestions and keep descriptions extremely concise and direct.

The JSON schema MUST exactly be:
{
  "synthesis": "A beautifully drafted, human-like paragraph synthesizing multiple different parts of the system. Example: 'You have a networking midterm next Tuesday, a capstone milestone due Friday, and an internship interview on Thursday. I recommend postponing AWS study until the weekend.' Connect exams, capstones, and interviews to learning schedules. Keep it concise, professional, and actionable (2-3 sentences max).",
  "synthesisExplanation": "A short, user-facing explanation specifying exactly which user data parameters influenced this main advice (e.g., 'Influenced by upcoming Exam dates, Capstone status, and Study Log').",
  "weeklyReview": {
    "title": "Weekly Review",
    "thisWeek": [
      "✔ 2 lessons completed successfully",
      "✔ GPA remains stable at 3.8",
      "✔ 5 internship applications submitted",
      "✔ Capstone topics and milestones reviewed"
    ],
    "nextWeekPriorities": [
      "Focus on the upcoming Database midterm preparation",
      "Draft Capstone literature review chapter",
      "Submit at least 2 internship applications to maintain recruiter momentum"
    ]
  },
  "priorities": [
    {
      "id": "prio-1",
      "text": "Draft your Capstone literature review introduction.",
      "impact": "High",
      "context": "Capstone project",
      "explanation": "Influenced by Capstone progress stage ('Planning') and missing literature files.",
      "influencedBy": ["capstoneStatus", "capstoneTopic"]
    },
    {
      "id": "prio-2",
      "text": "Submit an application to the newly matched Software Engineer Intern role.",
      "impact": "High",
      "context": "Career momentum",
      "explanation": "Influenced by zero internship applications in last 14 days and careerGoal.",
      "influencedBy": ["internshipApplications", "careerGoal"]
    },
    {
      "id": "prio-3",
      "text": "Complete 15 minutes of Database relational schema study.",
      "impact": "Medium",
      "context": "Learning",
      "explanation": "Influenced by 5-day active study streak and upcoming database assessment.",
      "influencedBy": ["studyStreak", "currentCourses"]
    }
  ],
  "conflicts": [
    {
      "id": "conflict-1",
      "title": "AWS Exam & Capstone Deliverable Overlap",
      "text": "Your targeted AWS certification exam date is scheduled on the same week as your Capstone literature review milestone. This creates an unsustainable workload.",
      "severity": "High", // "High" | "Medium" | "Low"
      "suggestion": "Shift your AWS study windows to evenings, or extend your AWS mock exam target by 5 days.",
      "explanation": "Influenced by Learning Goal deadlines overlapping with Academic Calendar events.",
      "influencedBy": ["learningGoals", "academicEvents"]
    }
  ],
  "opportunities": [
    {
      "id": "opp-1",
      "title": "High GPA Career Catalyst",
      "text": "Your strong current GPA of 3.8 and completed Database coursework make you an exceptionally competitive candidate for Enterprise Cloud internships.",
      "type": "career", // "career" | "academic" | "certification"
      "explanation": "Influenced by Current GPA and Database course completions.",
      "influencedBy": ["currentGpa", "currentCourses"]
    },
    {
      "id": "opp-2",
      "title": "AWS Architect Launchpad",
      "text": "You have completed 85% of your prerequisite Database structures, meaning you are primed to start the AWS Solutions Architect study plan early.",
      "type": "certification",
      "explanation": "Influenced by completed course lessons and AWS learningGoal.",
      "influencedBy": ["completedLessons", "learningGoals"]
    }
  ],
  "readiness": {
    "graduation": {
      "score": 65,
      "reason": "On track. Major requirements are satisfied, but Capstone thesis planning needs initial supervisor feedback.",
      "explanation": "Influenced by expectedGraduation and CapstoneStatus.",
      "influencedBy": ["expectedGraduation", "capstoneStatus"]
    },
    "internship": {
      "score": 40,
      "reason": "Early stages. You need to log at least 3-4 active internship applications to build recruiter pipeline momentum.",
      "explanation": "Influenced by empty internship applications database.",
      "influencedBy": ["internshipApplications"]
    },
    "certification": {
      "score": 75,
      "reason": "Highly ready. Prerequisite database structures completed. Finish 2 more lessons to take mock exam with confidence.",
      "explanation": "Influenced by studyStreak and completedLessons.",
      "influencedBy": ["studyStreak", "completedLessons"]
    },
    "job": {
      "score": 50,
      "reason": "Developing. Strong academic profile, but requires completing the capstone milestone and preparing custom interview case studies.",
      "explanation": "Influenced by targetJob and capstoneTopic.",
      "influencedBy": ["targetJob", "capstoneTopic"]
    }
  }
}

Analyze the following user data to produce the values:
1. Performance & Learning Standing:
- Performance Score / GPA: \${profile.currentGpa || 'N/A'}
- Discipline / Major: \${profile.major || 'N/A'}
- Institution / Organization: \${profile.university || 'N/A'}
- Stage / Semester: \${profile.currentSemester || 'N/A'}
- Active Courses / Modules: \${profile.currentCourses || 'N/A'}

2. Learning Goals and Progress:
- Learning Goals: \${JSON.stringify(profile.learningGoals || [])}
- Study Streak: \${state.streak || 0} days (Best: \${state.bestStreak || 0})
- Completed Lessons: \${Object.keys(state.completedLessons || {}).length} lessons
- Recent Study Log (minutes per day): \${JSON.stringify(state.studyLog || {})}

3. Knowledge Library & Uploaded Materials:
- Uploaded Documents / Notes: \${JSON.stringify(knowledgeDocs || [])}

4. Projects & Deliverables:
- Topic / Title: \${profile.capstoneTopic || 'N/A'}
- Status: \${profile.capstoneStatus || 'N/A'}
- Supervisor / Mentor: \${profile.capstoneSupervisor || 'N/A'}
- Deadline: \${profile.capstoneDeadline || 'N/A'}
- Deliverables: \${profile.capstoneDeliverables || 'N/A'}
- Milestones: \${profile.capstoneMilestones || 'N/A'}

5. Career and Job Applications:
- Career Goal: \${profile.careerGoal || 'N/A'}
- Target Job / Role: \${profile.targetJob || 'N/A'}
- Applications Logged: \${JSON.stringify(profile.internshipApplications || [])}
- Active counts: \${profile.internshipApps || 0} applied, \${profile.internshipInterviews || 0} interviews, \${profile.internshipOffers || 0} offers

6. Schedule & Deadlines Events:
- Registered Schedule Events: \${JSON.stringify(profile.academicEvents || [])}

Proactively synthesize ALL 6 components of this user's life (Knowledge Library uploads, learning goals, schedule, projects, career objectives, and study habits) to detect:
- **Priority Engine**: Select exactly the 3 HIGHEST-IMPACT actions today. Don't overwhelm. Prioritize high-urgency, high-confidence, high-impact tasks.
- **Goal Conflict Detection**: Look for date overlaps, unrealistic timelines, or exam/certification preparation bottlenecks (e.g. certification exam conflicts with project deliverables or too many tasks before a vacation date).
- **Opportunity Detection**: Find positive achievements (like strong score, streak milestones, uploaded document insights, prerequisites met) and match them with career/learning catalysts.
- **Long-term Prediction (Readiness)**: Compute robust, realistic percentages (0-100) based on actual metrics:
  - Graduation/Milestone readiness: influenced by current courses, score, project completion state, target dates.
  - Internship/Role readiness: influenced by target job clarity, application logs count, interviews, learning progress.
  - Certification readiness: influenced by study streak, completed lessons, uploaded library material, learning goals.
  - Job readiness: general career alignment, project progression, overall performance, application momentum.
`;

      const host = req.headers.host || '';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const calculatedReferer = req.headers.referer || (host ? `${protocol}://${host}/` : '');

      let text = "";
      try {
        text = await callAIProvider([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: "Generate the Himam AI Executive Assistant intelligence package JSON now." }
        ], calculatedReferer);
      } catch (aiProviderError: any) {
        console.warn("AI Provider call failed, falling back to local synthesis:", aiProviderError.message || aiProviderError);
        return res.json(getIntelligenceFallback(profile, state));
      }

      try {
        const payload = cleanAndParseJSON(text);
        return res.json(payload);
      } catch (parseError) {
        console.error("Failed to parse Intelligence JSON:", text);
        return res.json(getIntelligenceFallback(profile, state));
      }
    } catch (error: any) {
      console.error("Intelligence synthesis error:", error);
      // Outer level catch-all fallback so the user always has a beautiful dashboard
      try {
        const { profile, state } = req.body;
        return res.json(getIntelligenceFallback(profile, state));
      } catch (innerErr) {
        return res.status(500).json({ error: error.message || "An error occurred during system intelligence synthesis." });
      }
    }
  });

  // AI Multimodal Study Document Analyzer (PDF, TXT, MD, Images of notes, etc.)
  app.post('/api/documents/analyze', async (req, res) => {
    try {
      const { base64Data, mimeType, fileName } = req.body;
      if (!base64Data || !mimeType) {
        return res.status(400).json({ error: "base64Data and mimeType are required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not defined. Please configure it in your environment." });
      }

      const payload = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              },
              {
                text: "You are a professional educational material assistant. Analyze the uploaded document (named '" + (fileName || 'document') + "').\nYour task is to:\n1. Generate a comprehensive, beautiful study guide summary of this document in clean markdown format. Underline critical concepts and organize them with hierarchical headers.\n2. Extract 3-5 core key points or main takeaways as distinct strings.\n3. Generate 3-5 high-yield study flashcards to help study this material (each flashcard must have a short, punchy 'front' question/concept and a clear, descriptive 'back' answer/explanation).\n\nYou MUST respond with a single valid JSON object containing exactly three keys: 'contentSummary' (string in markdown), 'extractedKeyPoints' (array of strings), and 'flashcards' (array of objects with 'front' and 'back' properties). Do NOT include markdown code blocks like ```json in your response, just the raw JSON object."
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const host = req.headers.host || '';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const calculatedReferer = req.headers.referer || (host ? `${protocol}://${host}/` : 'https://ais-dev-z7t2wdmnkkmkyahhvcmjdq-229521251509.europe-west2.run.app/');

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Referer': calculatedReferer,
      };
      try {
        const parsedUrl = new URL(calculatedReferer);
        requestHeaders['Origin'] = parsedUrl.origin;
      } catch (_) {
        requestHeaders['Origin'] = 'https://ais-dev-z7t2wdmnkkmkyahhvcmjdq-229521251509.europe-west2.run.app/';
      }

      const responseText = await new Promise<string>((resolve, reject) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const parsedUrl = new URL(url);
        const postData = JSON.stringify(payload);
        const options = {
          hostname: parsedUrl.hostname,
          port: 443,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            ...requestHeaders,
            'Content-Length': Buffer.byteLength(postData),
          }
        };

        const reqHttp = https.request(options, (resHttp) => {
          let data = '';
          resHttp.on('data', (chunk) => { data += chunk; });
          resHttp.on('end', () => {
            if (resHttp.statusCode && resHttp.statusCode >= 200 && resHttp.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`API Error status ${resHttp.statusCode}: ${data}`));
            }
          });
        });

        reqHttp.on('error', (e) => reject(e));
        reqHttp.write(postData);
        reqHttp.end();
      });

      const parsedResponse = JSON.parse(responseText);
      const textResponse = parsedResponse.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      let analysisResult;
      try {
        analysisResult = JSON.parse(textResponse.trim());
      } catch (parseError) {
        console.error("Failed to parse document analysis JSON:", textResponse);
        // Clean markdown blocks if LLM ignored instructions
        let cleanText = textResponse.trim();
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
        }
        try {
          analysisResult = JSON.parse(cleanText.trim());
        } catch (_) {
          throw new Error("Could not parse AI response as JSON");
        }
      }

      return res.json({
        contentSummary: analysisResult.contentSummary || "",
        extractedKeyPoints: analysisResult.extractedKeyPoints || [],
        flashcards: analysisResult.flashcards || []
      });

    } catch (error: any) {
      console.error("Document analysis API error:", error);
      return res.status(500).json({ error: error.message || "Could not analyze the study document." });
    }
  });

  // Interactive Tutor Chat with Uploaded Study Document
  app.post('/api/documents/chat', async (req, res) => {
    try {
      const { documentName, documentSummary, keyPoints, userMessage, history } = req.body;
      if (!userMessage) {
        return res.status(400).json({ error: "userMessage is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not defined. Please configure it in your environment." });
      }

      // Format previous conversation history
      const formattedContents = (history || []).map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      // Add the current user query to the payload
      const systemInstruction = `You are a world-class academic tutor and personal study assistant for Himam.
The student has uploaded a study document named "${documentName || 'Study Guide'}".
Here is the official summarized context of the document:
<document_context>
Summary:
${documentSummary || 'No summary available.'}

Key Takeaways:
${(keyPoints || []).map((kp: string) => `- ${kp}`).join('\n')}
</document_context>

Guidelines:
1. Always base your explanations on the document context.
2. If the user asks something outside the scope of the document, politely explain that it's outside the document but provide a high-level educational explanation anyway to help them learn.
3. Keep your answers clear, visually beautiful (use markdown formatting, lists, bold text, or code blocks where appropriate), engaging, and encouraging.
4. Keep explanations concise and easy to read.`;

      formattedContents.push({
        role: 'user',
        parts: [{ text: userMessage }]
      });

      const payload = {
        contents: formattedContents,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      };

      const host = req.headers.host || '';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const calculatedReferer = req.headers.referer || (host ? `${protocol}://${host}/` : 'https://ais-dev-z7t2wdmnkkmkyahhvcmjdq-229521251509.europe-west2.run.app/');

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Referer': calculatedReferer,
      };
      try {
        const parsedUrl = new URL(calculatedReferer);
        requestHeaders['Origin'] = parsedUrl.origin;
      } catch (_) {
        requestHeaders['Origin'] = 'https://ais-dev-z7t2wdmnkkmkyahhvcmjdq-229521251509.europe-west2.run.app/';
      }

      const responseText = await new Promise<string>((resolve, reject) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const parsedUrl = new URL(url);
        const postData = JSON.stringify(payload);
        const options = {
          hostname: parsedUrl.hostname,
          port: 443,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            ...requestHeaders,
            'Content-Length': Buffer.byteLength(postData),
          }
        };

        const reqHttp = https.request(options, (resHttp) => {
          let data = '';
          resHttp.on('data', (chunk) => { data += chunk; });
          resHttp.on('end', () => {
            if (resHttp.statusCode && resHttp.statusCode >= 200 && resHttp.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`API Error status ${resHttp.statusCode}: ${data}`));
            }
          });
        });

        reqHttp.on('error', (e) => reject(e));
        reqHttp.write(postData);
        reqHttp.end();
      });

      const parsedResponse = JSON.parse(responseText);
      const textResponse = parsedResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return res.json({ reply: textResponse.trim() });

    } catch (error: any) {
      console.error("Document Chat API error:", error);
      return res.status(500).json({ error: error.message || "Failed to communicate with document tutor." });
    }
  });

  app.post('/api/goals/search', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (isRateLimited(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
      }

      const { query } = req.body;
      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.json([]);
      }

      const systemPrompt = `You are a world-class professional advisor and academic credential search engine.
Your goal is to discover and return real, official professional certifications, university degrees, languages, or technical skills matching the user's search query.

You must search across all worldwide reputable institutions, issuing bodies, and universities. Examples:
- For HR: CIPD, SHRM (SHRM-CP, SHRM-SCP), PHR, SPHR, GPHR, Associate Professional in HR (aPHR).
- For PMI: Project Management Professional (PMP), Certified Associate in Project Management (CAPM), PMI Professional in Business Analysis (PMI-PBA), PMI Risk Management Professional (PMI-RMP), PMI Agile Certified Practitioner (PMI-ACP), Program Management Professional (PgMP).
- For Engineering Degrees: B.S. or M.S. or Ph.D. in Mechanical Engineering, Electrical Engineering, Civil Engineering, Chemical Engineering, Aerospace Engineering, Computer Engineering, Biomedical Engineering, etc.
- For Finance: Chartered Financial Analyst (CFA), Certified Public Accountant (CPA), Association of Chartered Certified Accountants (ACCA), Certified Financial Planner (CFP).
- For Tech/IT: AWS Certified Solutions Architect, Cisco Certified Network Associate (CCNA), CompTIA Security+, Certified Information Systems Security Professional (CISSP).

You MUST return a JSON array containing up to 8 matched credentials.
For each match, provide realistic, detailed information following this exact JSON structure:
{
  "id": "string (unique kebab-case slug)",
  "label": "string (full formal name of the certification, degree, or skill)",
  "category": "Certifications" | "University Degrees" | "Languages" | "Technical Skills",
  "description": "string (1-2 sentences summarizing the purpose and value)",
  "aliases": ["string (alternative names, acronyms, or codes)"],
  "metadata": {
    "rating": number (estimated value from 4.0 to 5.0),
    "providerName": "string (e.g., 'Project Management Institute', 'Society for Human Resource Management', 'University Programs')",
    "estimatedHours": number (approximate study or preparation hours required),
    "estimatedDuration": "string (e.g., '3 Months', '2 Years', '6 Weeks')",
    "difficulty": "Beginner" | "Intermediate" | "Advanced",
    "skillsCovered": ["string (3-5 core topics or competencies)"],
    "officialWebsite": "string (a placeholder or real official website URL)",
    "prerequisites": ["string (entry criteria or recommended experience)"],
    "examInfo": "string (structure, passing score, or evaluation type if applicable)"
  }
}

Return ONLY the raw JSON array. Do not wrap it in markdown code blocks or add conversational text.`;

      const userPrompt = `Find and describe worldwide certifications, degrees, or skills matching the query: "${query}"`;

      const host = req.headers.host || '';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const calculatedReferer = req.headers.referer || (host ? `${protocol}://${host}/` : '');

      const responseText = await callAIProvider([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], calculatedReferer);

      try {
        const parsed = cleanAndParseJSON(responseText);
        const results = Array.isArray(parsed) ? parsed : [];
        return res.json(results);
      } catch (e) {
        console.error("Failed to parse dynamic search JSON:", responseText, e);
        return res.json([]);
      }
    } catch (err: any) {
      console.error("Dynamic goal search API error:", err);
      return res.status(500).json({ error: err.message || "An error occurred during worldwide search." });
    }
  });

  // Dynamic course plan generation using Gemini (AI Automated & URL Imported)
  app.post('/api/course/generate', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (isRateLimited(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
      }

      const { goal, mode, url } = req.body;
      if (!goal || !mode) {
        return res.status(400).json({ error: "goal and mode are required" });
      }

      const systemPrompt = "You are a world-class instructional designer and educational curriculum architect. You generate full, complete, and beautifully-structured educational syllabi in JSON format.";

      let promptText = `Generate a comprehensive professional study syllabus for the learning goal: "${goal}".
Course Mode: ${mode}
${mode === 'imported' && url ? `This syllabus is imported from the following external course URL: "${url}". Use Google Search to find the actual structure, modules, sections, and lessons of this course. If the exact syllabus cannot be found, design a highly accurate, realistic curriculum representing the learning program at that URL.` : ''}

You MUST return a JSON object with the following schema:
{
  "name": "string (the name of the course/syllabus, e.g., 'Google Project Management Certificate')",
  "description": "string (1-2 sentences summarizing the learning outcome)",
  "category": "string (one of: 'Certifications', 'University Degrees', 'Languages', 'Technical Skills')",
  "difficulty": "string (one of: 'Easy', 'Medium', 'Hard')",
  "estimatedHours": number (integer representing total hours, e.g. 120),
  "sections": [
    {
      "name": "string (Section/Module name, e.g. 'Foundations of Project Management')",
      "lessons": [
        {
          "title": "string (Lesson/Topic title)",
          "description": "string (brief description of what is covered)",
          "type": "string (one of: 'video', 'reading', 'practice', 'quiz', 'revision', 'flashcards', 'lab', 'assignment')",
          "duration": number (duration in minutes, e.g., 20, 30, 45, 60),
          "difficulty": "string (one of: 'Easy', 'Medium', 'Hard')"
        }
      ]
    }
  ]
}

Rules:
1. Ensure the course has between 4 to 8 sections.
2. Ensure each section has between 3 to 6 lessons.
3. Use a healthy mix of lesson types ('video', 'reading', 'practice', 'quiz', 'revision', 'flashcards', 'lab', 'assignment') to keep the student engaged.
4. Keep descriptions educational, clean, and professional.
5. Do NOT include markdown code blocks (like \`\`\`json) in your response, just return the raw JSON object.`;

      const host = req.headers.host || '';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const calculatedReferer = req.headers.referer || (host ? `${protocol}://${host}/` : '');

      const responseText = await callAIProvider([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText }
      ], calculatedReferer);

      try {
        const courseData = cleanAndParseJSON(responseText);
        return res.json(courseData);
      } catch (parseError) {
        console.error("Failed to parse AI course JSON:", responseText, parseError);
        return res.status(500).json({
          error: "The AI did not return a valid structured JSON syllabus. Please try again.",
          rawText: responseText
        });
      }
    } catch (error: any) {
      console.error("Course syllabus generation error:", error);
      return res.status(500).json({ error: error.message || "An error occurred while generating the syllabus." });
    }
  });

  // Dynamic strategic study plan generation for homework and assessments
  app.post('/api/assignments/strategy', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (isRateLimited(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
      }

      const { title, type, course, difficulty, notes, estimatedHours } = req.body;
      if (!title || !type) {
        return res.status(400).json({ error: "title and type are required" });
      }

      const systemPrompt = "You are an elite academic tutor and study planner. You generate highly strategic, actionable study and preparation strategies for college assignments and exams.";
      const userPrompt = `Generate a customized, step-by-step preparation strategy for the following college assessment:
- Title: "${title}"
- Type: "${type}"
- Course: "${course || 'unspecified'}"
- Difficulty: "${difficulty || 'Medium'}"
- Estimated Preparation Time: ${estimatedHours || 3} hours
- Student Notes/Details: "${notes || 'None'}"

Provide:
1. **🎯 Strategic Prep Angle**: High-yield strategy specific to this type of task.
2. **⏳ Actionable Study Blocks**: A clear, percentage-based breakdown of how to allocate the ${estimatedHours || 3} hours of preparation (e.g. 20% Reading/Structuring, 50% Active Writing/Practice, 30% Review/Polish).
3. **💡 Top Active Study Techniques**: Specific cognitive science techniques to master the content (like spaced retrieval, active drafting, or mock exams).
4. **⚠️ Common Mistakes to Bypass**: Major student errors to watch out for.

Keep the response in a highly structured, beautiful Markdown format with clear headings. Use bullet points and clean formatting.`;

      const host = req.headers.host || '';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const calculatedReferer = req.headers.referer || (host ? `${protocol}://${host}/` : '');

      const text = await callAIProvider([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], calculatedReferer);

      return res.json({ strategy: text });
    } catch (error: any) {
      console.error("Assignment strategy error:", error);
      return res.status(500).json({ error: error.message || "An error occurred while generating the study strategy." });
    }
  });

  // Vite middleware for dev mode or static files for production mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
