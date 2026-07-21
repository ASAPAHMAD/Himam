/**
 * AI Coach conversation history — persistence.
 *
 * Deliberately its own, isolated localStorage key and its own tiny store,
 * separate from STORE_KEY (StudyPlanState) and PROFILE_STORE_KEY (Profile)
 * in App.tsx. This is new data for a new feature, not a change to an
 * existing schema, so it doesn't touch models/studyPlanStateMigration.ts,
 * models/profileMigration.ts, or models/cloudPersistence.ts. Carries its own
 * `schemaVersion` field from day one (lesson learned from those files, per
 * ARCHITECTURE.md) so it can grow its own versioned migration later without
 * a "silently guess the shape" step.
 *
 * Local-only for now, matching the app's offline-first default; cloud sync
 * for conversation history is a natural but separate follow-up (same
 * pattern as models/cloudPersistence.ts), not required for this feature to
 * be useful.
 */
import { generateId } from './id';

const STORE_KEY = 'himam_ai_coach_history_v1';
const SCHEMA_VERSION = 1;

export interface AICoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string; // ISO
  source?: 'deterministic' | 'cache' | 'live';
}

export interface AICoachConversation {
  id: string;
  title: string;
  /** The full message list actually sent to the provider, including the
   * leading system message — kept so follow-up turns don't need to rebuild
   * context from scratch (see components/AICoach.tsx). */
  providerMessages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  /** Display-only transcript (system message excluded) for rendering. */
  displayMessages: AICoachMessage[];
  createdAt: string;
  updatedAt: string;
}

interface StoredShape {
  schemaVersion: number;
  conversations: AICoachConversation[];
}

function readStore(): StoredShape {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { schemaVersion: SCHEMA_VERSION, conversations: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.conversations)) {
      return { schemaVersion: SCHEMA_VERSION, conversations: [] };
    }
    return parsed;
  } catch {
    return { schemaVersion: SCHEMA_VERSION, conversations: [] };
  }
}

function writeStore(store: StoredShape): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('Could not write AI Coach history to local storage', e);
  }
}

export function loadConversations(): AICoachConversation[] {
  return readStore().conversations.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function saveConversation(conversation: AICoachConversation): void {
  const store = readStore();
  const idx = store.conversations.findIndex(c => c.id === conversation.id);
  if (idx >= 0) {
    store.conversations[idx] = conversation;
  } else {
    store.conversations.push(conversation);
  }
  writeStore(store);
}

export function deleteConversation(conversationId: string): void {
  const store = readStore();
  store.conversations = store.conversations.filter(c => c.id !== conversationId);
  writeStore(store);
}

export function createEmptyConversation(title: string): AICoachConversation {
  const now = new Date().toISOString();
  return {
    id: generateId('coach_convo'),
    title,
    providerMessages: [],
    displayMessages: [],
    createdAt: now,
    updatedAt: now,
  };
}
