/**
 * AI Coach network client.
 *
 * The only module in the AI Coach feature that knows a network call is
 * involved. Sends a Google/Gemini-shaped (or standard OpenAI-style) `messages` array (role/content pairs) to
 * the server-side /api/coach proxy — see server.ts for the provider switch.
 * Components never call fetch() directly; they call sendCoachMessages().
 */
import { apiFetch } from './apiClient';

export type AICoachChatRole = 'system' | 'user' | 'assistant';

export interface AICoachChatMessage {
  role: AICoachChatRole;
  content: string;
}

export async function sendCoachMessages(messages: AICoachChatMessage[]): Promise<string> {
  const response = await apiFetch('/api/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Server returned an error');
  }
  return data.text as string;
}

export interface CandidateMemory {
  id?: string; // If updating/merging, refer to the existing memory ID
  action?: 'create' | 'update' | 'delete';
  category: string;
  importance: number;
  confidence: number;
  summary: string;
  source: string;
}

export async function extractMemories(messages: AICoachChatMessage[], existingMemories: any[]): Promise<CandidateMemory[]> {
  try {
    const response = await apiFetch('/api/coach/extract-memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, existingMemories }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.memories || []) as CandidateMemory[];
  } catch (error) {
    console.error('Failed to extract memories client-side:', error);
    return [];
  }
}

