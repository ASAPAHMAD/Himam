/**
 * AI Coach prompt templates.
 *
 * Turns an AIContext (services/aiContextBuilder.ts) plus a chosen "intent"
 * into plain text. Pure string composition — no network calls, no provider
 * SDKs, no React. This is intentionally the *only* place prompt wording
 * lives, so every provider adapter (Google Gemini today, OpenAI/Anthropic later)
 * sends the same words for the same intent — see services/aiCoachClient.ts
 * and server.ts for where the provider split actually happens.
 */
import { AIContext } from './aiContextBuilder';

export type AICoachIntent =
  | 'today_plan'
  | 'am_i_on_track'
  | 'adjust_schedule'
  | 'explain_lesson'
  | 'generate_learning_plan'
  | 'review_progress'
  | 'ask_anything';

export interface AICoachIntentDef {
  id: AICoachIntent;
  label: string;
  description: string;
  /** 'explain_lesson' has nothing useful to say without a lesson chosen first. */
  requiresFocusLesson?: boolean;
  /** 'generate_learning_plan' / 'ask_anything' need the learner's own words. */
  requiresFreeformInput?: boolean;
}

export const AI_COACH_INTENTS: AICoachIntentDef[] = [
  { id: 'today_plan', label: "Today's Study Plan", description: "What should I study today, and in what order?" },
  { id: 'am_i_on_track', label: 'Am I On Track?', description: 'Check my pace against my target dates' },
  { id: 'adjust_schedule', label: 'Adjust My Schedule', description: "Rebalance this week around what's realistic" },
  { id: 'explain_lesson', label: 'Explain This Lesson', description: 'Get a plain-language walkthrough of a lesson', requiresFocusLesson: true },
  { id: 'generate_learning_plan', label: 'Generate Learning Plan', description: 'Build a study plan for a new or custom goal', requiresFreeformInput: true },
  { id: 'review_progress', label: 'Review My Progress', description: 'A full audit of streaks, pace, and completion' },
  { id: 'ask_anything', label: 'Ask Anything', description: 'Ask your coach anything, in your own words', requiresFreeformInput: true },
];

const LEARNING_STYLE_GUIDANCE: Record<string, string> = {
  Visual: 'Lean on visual, demo-style explanations — describe what a screen recording or diagram would show, step by step.',
  Audio: 'Lean on spoken explanations, verbal summaries, and conversational phrasing.',
  Reading: 'Lean on clear written explanations and structured text — short paragraphs and bullet points over conversational analogies.',
  Practice: 'Lean on hands-on framing — give a small concrete exercise or worked example rather than pure theory.',
  Discussion: 'Lean on conversation and explanation-by-example — frame ideas as something to talk through.',
  'Spaced repetition': 'Reinforce concepts through short review loops and recall prompts rather than long uninterrupted blocks.',
  'Project-based': 'Anchor the explanation to a concrete project or deliverable so the learner can connect it to real work.',
  Structured: 'Use a clear sequence, checklist, and milestone-oriented framing.',
  Reflective: 'Encourage a short reflection or self-check after each concept so the learner can internalize it.',
  Collaborative: 'Frame the guidance around sharing, peer feedback, and co-working.',
  Gamified: 'Turn the guidance into a challenge or progression-based experience with clear milestones.',
  Mixed: 'Blend a brief explanation with a concrete example — do not lean too heavily on any single style.',
};

/** Falls back to Target Job when no separate career-goal narrative was set —
 * Target Job already captures the same intent (see onboarding/CareerStep.tsx,
 * which no longer asks for both to avoid the redundant, confusing overlap). */
function describeCareerGoal(context: AIContext): string {
  if (context.learner.careerGoal) return context.learner.careerGoal;
  if (context.learner.targetJob) return `Move into a ${context.learner.targetJob} role`;
  return '';
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0 min';
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return hours > 0 ? `${hours}h ${rem}m` : `${rem}m`;
}

function describeCourses(context: AIContext): string {
  if (context.courses.length === 0 && context.customGoals.length === 0) {
    return '- No active learning goals configured yet.';
  }
  const lines = context.courses.map(c => {
    const target = c.examDate ? `, target date ${c.examDate}` : '';
    return `- ${c.name}: ${c.completedLessons}/${c.totalLessons} lessons complete (${c.completionPercentage}%), ${formatMinutes(c.remainingMinutes)} remaining${target}`;
  });
  context.customGoals.forEach(g => lines.push(`- ${g}: active custom learning goal (no structured catalog content yet)`));
  return lines.join('\n');
}

function describeAvailability(context: AIContext): string {
  const days = context.availability.workingDays.join(', ') || 'no working days configured';
  const windows = context.availability.studyWindows
    .map(w => `${w.label || 'Session'} (${w.startTime}\u2013${w.endTime}, ~${w.minutes} min)`)
    .join('; ') || 'no study windows configured';
  const vac = context.availability.vacationRanges
    .map(v => `${v.start} to ${v.end}`)
    .join(', ');
  return `Working days: ${days}. Study windows: ${windows}.${vac ? ` Upcoming/active vacation blocks: ${vac}.` : ''}`;
}

function describeDay(day: AIContext['today'], label: string): string {
  if (!day.isWorkable) {
    return `${label}: ${day.isVacation ? 'a scheduled vacation day (no study expected)' : 'not a scheduled working day'}.`;
  }
  const lessonLines = day.windows
    .flatMap(w => w.lessons.map(l => `${l.courseShortLabel ? `[${l.courseShortLabel}] ` : ''}${l.title} (${l.duration}m)`));
  if (lessonLines.length === 0) {
    return `${label}: a working day, but no pending lessons are queued into it yet (${day.totalMinutes} min budgeted).`;
  }
  return `${label} (${day.totalMinutes} min planned): ${lessonLines.join('; ')}.`;
}

function describeWeek(context: AIContext): string {
  return context.upcomingWeek.map(d => describeDay(d, d.dateStr)).join('\n');
}

function describeMemories(context: AIContext): string {
  if (!context.memories || context.memories.length === 0) {
    return '';
  }
  const lines = context.memories.map(m => {
    return `- [${m.category.toUpperCase()}] ${m.summary} (Importance: ${m.importance}/10, Confidence: ${Math.round(m.confidence * 100)}%)`;
  });
  return `\nCOACH MEMORIES (Long-Term Observations)\n${lines.join('\n')}\nUse these observations to personalize your explanation, tone, pacing, and recommendations. For example, if a memory notes a weakness in DAX, actively support them with DAX, or if it notes a visual preference, use visual analogies.`;
}

/**
 * System prompt: sets the coach's persona and hands over the full context
 * as structured facts. Identical for every intent — the *instruction* is
 * what changes per intent (see buildCoachUserPrompt below).
 */
export function buildCoachSystemPrompt(context: AIContext): string {
  const firstName = context.learner.name.split(' ')[0] || context.learner.name;
  const learningStyle = context.learner.learningStyle;
  const learningStyleGuidance = learningStyle ? (LEARNING_STYLE_GUIDANCE[learningStyle] || 'Tailor explanations to the learner’s stated preference and default to a balanced mix if it is unclear.') : 'ask them to set one in Preferences for more tailored explanations, and default to a balanced mix for now.';
  return `You are Himam's AI Study Coach for ${context.learner.name}${context.learner.currentJob ? `, currently working as ${context.learner.currentJob}` : ''}${context.learner.country ? ` in ${context.learner.country}` : ''}. Be direct, professional, encouraging but not fluffy — no generic pleasantries, no filler intros or outros. Ground every answer only in the facts below; never invent lesson names, dates, or numbers that aren't given to you.

LEARNER
- Name: ${context.learner.name} (call them "${firstName}")
${describeCareerGoal(context) ? `- Career goal: ${describeCareerGoal(context)}\n` : ''}${(context.learner.currentSalary || context.learner.targetSalary) ? `- Salary trajectory: ${context.learner.currentSalary || 'unspecified'} -> ${context.learner.targetSalary || 'unspecified'}\n` : ''}- Preferred learning style: ${context.learner.learningStyle || 'not set yet'}${context.learner.learningStyle ? ` \u2014 ${LEARNING_STYLE_GUIDANCE[context.learner.learningStyle]}` : ' \u2014 ask them to set one in Preferences for more tailored explanations, and default to a balanced mix for now.'}

AVAILABILITY
${describeAvailability(context)}

ACTIVE LEARNING GOALS
${describeCourses(context)}

PROGRESS SNAPSHOT
- Overall completion: ${context.progress.overallCompletionPercentage}% (${context.progress.totalLessonsRemaining} lessons / ${formatMinutes(context.progress.remainingMinutes)} remaining)
- Pacing: ${context.progress.pacingStatus} relative to target dates
- Estimated completion: ${context.progress.estimatedCompletionLabel}
- Streak: ${context.progress.currentStreak} days (best: ${context.progress.bestStreak})
- Daily average study time: ${context.progress.dailyAverageMinutes} min

TODAY'S SCHEDULE
${describeDay(context.today, 'Today')}

NEXT 7 DAYS
${describeWeek(context)}
${context.focusLesson ? `\nFOCUS LESSON\n- "${context.focusLesson.title}" (${context.focusLesson.type}, ${context.focusLesson.duration} min) from ${context.focusLesson.courseName}${context.focusLesson.description ? `\n- Description: ${context.focusLesson.description}` : ''}` : ''}${describeMemories(context)}`;
}

/**
 * Per-intent instruction. This is the only thing that differs between the
 * 7 suggested prompts — all of them read from the exact same context above.
 */
export function buildCoachUserPrompt(intent: AICoachIntent, context: AIContext, userMessage?: string): string {
  switch (intent) {
    case 'today_plan':
      return "Based on today's schedule and my active goals, tell me exactly what to study today and in what order. Keep it under 120 words, concrete, no fluff.";

    case 'am_i_on_track':
      return 'Am I on track to hit my target dates given my current pace and streak? Give a direct yes/no verdict first, then at most 3 short reasons. Under 100 words.';

    case 'adjust_schedule':
      return "Looking at my working days, study windows, and the next 7 days of scheduled lessons, suggest one concrete adjustment to rebalance my week if it's needed \u2014 or tell me it's already well-balanced. Under 120 words.";

    case 'explain_lesson':
      return context.focusLesson
        ? `Provide a highly interactive, action-oriented walkthrough for the lesson "${context.focusLesson.title}" from ${context.focusLesson.courseName} in plain language.
Ensure you structure your explanation into the following sections with distinct markdown headings:

1. **The Concept**: Explain in plain language using a practical, relatable analogy.
2. **Why this matters**: Connect this concept directly to career context or report performance.
3. **Common mistake**: Detail a typical mistake learners make and how to avoid it.
4. **Practice now**: Give the learner a highly specific, 10-minute hands-on practice challenge or exercise to do right now.
5. **Ask a follow-up**: Give 2 specific follow-up questions they could ask you right now.

Make the tone supportive, encouraging, and incredibly educational. Keep it under 250 words total, punchy and highly professional.`
        : 'No specific lesson was selected to explain \u2014 ask the learner which lesson they want explained.';

    case 'generate_learning_plan':
      return userMessage
        ? `Generate a structured, week-by-week learning plan for this goal: "${userMessage}". Fit it around my existing availability and active goals shown above \u2014 don't ignore my current workload. Use short headers and bullet points.`
        : 'Ask the learner what new goal, certification, degree, or skill they want a learning plan for.';

    case 'review_progress':
      return 'Give me a full progress audit: overall completion, pacing, streak health, and the single biggest risk to my target dates right now. Then give exactly 3 specific next actions. Under 180 words.';

    case 'ask_anything':
    default:
      return userMessage || 'The learner opened a free-form question but has not typed anything yet.';
  }
}
