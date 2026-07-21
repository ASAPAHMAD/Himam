import { AICoachChatMessage, sendCoachMessages } from './aiCoachClient';

/**
 * AI Orchestrator Service
 *
 * Sits between UI components and the AI Coach Client to:
 * 1. Implement deterministic/local-first logic to bypass LLM calls for simple queries (greetings, system questions).
 * 2. Manage an intelligent cache (in-memory and localStorage-backed) to prevent duplicate expensive LLM calls.
 * 3. Optimize cost and speed by serving instant, cached or pre-packaged responses where possible.
 */

interface CacheEntry {
  response: string;
  timestamp: number;
  expiresAt: number;
}

// In-memory cache map
const memoryCache = new Map<string, CacheEntry>();

// Cache expiration: 24 hours for educational explanations
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Normalizes and hashes/serializes message arrays to generate a unique cache key
 */
function generateCacheKey(messages: AICoachChatMessage[]): string {
  // Strip system messages and normalize whitespaces for user prompt content
  const significantParts = messages
    .filter(msg => msg.role !== 'system')
    .map(msg => `${msg.role}:${msg.content.trim().toLowerCase()}`);
  return JSON.stringify(significantParts);
}

/**
 * Quick checks if the message is a simple standard greeting or platform question
 * that can be answered with deterministic, delightful logic instantly.
 */
function handleLocalDeterministicRouting(messages: AICoachChatMessage[]): string | null {
  const lastUserMessage = [...messages]
    .reverse()
    .find(msg => msg.role === 'user')
    ?.content.trim().toLowerCase();

  if (!lastUserMessage) return null;

  // Simple greetings
  if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)\b/i.test(lastUserMessage)) {
    return `Hello! 👋 I am your Himam AI Learning Coach. 

I'm ready to help you:
*   **Generate personalized study schedules** and target dates.
*   **Explain complex lesson concepts** with career actions.
*   **Run adaptive quizzes** to test your knowledge.

What would you like to focus on today?`;
  }

  // Who are you / help queries
  if (/^(who are you|what can you do|how do you work|help me|help)\b/i.test(lastUserMessage)) {
    return `I am the **Himam AI Learning Coach**, an advanced educational companion designed to orchestrate your professional learning journey.

Here's how I optimize your study:
1.  **AI Explanations**: Visual, styled content with career contexts and action plans.
2.  **Adaptive Quizzes**: Generates Easy/Medium/Hard problems dynamically, tailoring questions to your historical accuracy.
3.  **Active Progress**: Evaluates metrics like burnout risk and completion velocity using the learning analytics engine.

How can I assist you right now?`;
  }

  return null;
}

/**
 * Orchestrates the AI call. Checks deterministic routing first, then caches.
 */
export async function orchestrateCoachCall(
  messages: AICoachChatMessage[],
  options?: { bypassCache?: boolean; forceLive?: boolean }
): Promise<{ text: string; source: 'deterministic' | 'cache' | 'live' }> {
  // 1. Check deterministic local route
  const localResponse = handleLocalDeterministicRouting(messages);
  if (localResponse && !options?.forceLive) {
    return { text: localResponse, source: 'deterministic' };
  }

  // 2. Generate cache key
  const cacheKey = generateCacheKey(messages);

  // 3. Check memory cache unless bypassed
  if (!options?.bypassCache && !options?.forceLive) {
    const memoryHit = memoryCache.get(cacheKey);
    if (memoryHit && memoryHit.expiresAt > Date.now()) {
      return { text: memoryHit.response, source: 'cache' };
    }

    // Check localStorage cache for cross-session consistency
    try {
      const localStored = localStorage.getItem(`himam_ai_cache_${cacheKey}`);
      if (localStored) {
        const parsed = JSON.parse(localStored) as CacheEntry;
        if (parsed.expiresAt > Date.now()) {
          memoryCache.set(cacheKey, parsed); // populate memory cache
          return { text: parsed.response, source: 'cache' };
        } else {
          localStorage.removeItem(`himam_ai_cache_${cacheKey}`);
        }
      }
    } catch (e) {
      console.warn('LocalStorage cache reading failed', e);
    }
  }

  // 4. Call actual AI Client (Live)
  const responseText = await sendCoachMessages(messages);

  // 5. Populate cache if successful
  if (responseText && !options?.forceLive) {
    const cacheEntry: CacheEntry = {
      response: responseText,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL,
    };

    memoryCache.set(cacheKey, cacheEntry);

    try {
      localStorage.setItem(`himam_ai_cache_${cacheKey}`, JSON.stringify(cacheEntry));
    } catch (e) {
      console.warn('LocalStorage cache writing failed', e);
    }
  }

  return { text: responseText, source: 'live' };
}

/**
 * Clears expired or all cache entries
 */
export function clearAICoachCache(all: boolean = false): void {
  memoryCache.clear();
  if (all) {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('himam_ai_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Failed to clear localStorage cache', e);
    }
  }
}
