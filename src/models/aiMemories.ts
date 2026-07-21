import { supabase } from '../lib/supabase';
import { AIMemory, MemoryCategory } from './types';

const LOCAL_STORE_KEY = 'himam_ai_memories_v1';

export function loadLocalMemories(): AIMemory[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalMemory(memory: AIMemory): void {
  try {
    const memories = loadLocalMemories();
    const idx = memories.findIndex(m => m.id === memory.id);
    if (idx >= 0) {
      memories[idx] = memory;
    } else {
      memories.push(memory);
    }
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(memories));
  } catch (e) {
    console.error('saveLocalMemory failed:', e);
  }
}

export function deleteLocalMemory(memoryId: string): void {
  try {
    const memories = loadLocalMemories();
    const filtered = memories.filter(m => m.id !== memoryId);
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('deleteLocalMemory failed:', e);
  }
}

export async function loadCloudMemories(userId: string): Promise<AIMemory[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('ai_memories')
      .select('*')
      .eq('user_id', userId);
    if (error) {
      // Graceful fallback if table is not created yet (e.g. migration pending)
      console.warn('loadCloudMemories table check failed:', error.message);
      return null;
    }
    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      category: row.category as MemoryCategory,
      importance: row.importance,
      confidence: parseFloat(row.confidence),
      summary: row.summary,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
    }));
  } catch (err) {
    console.error('loadCloudMemories error:', err);
    return null;
  }
}

export async function saveCloudMemory(userId: string, memory: AIMemory): Promise<boolean> {
  if (!supabase) return false;
  try {
    const row = {
      id: (memory.id && memory.id.startsWith('mem_')) ? undefined : memory.id, // let Supabase auto-generate ID if it's a temporary UI prefix
      user_id: userId,
      category: memory.category,
      importance: memory.importance,
      confidence: memory.confidence,
      summary: memory.summary,
      source: memory.source,
      updated_at: new Date().toISOString(),
      expires_at: memory.expiresAt || null,
      last_used_at: memory.lastUsedAt || null,
    };
    const { error } = await supabase.from('ai_memories').upsert(row);
    if (error) {
      console.warn('saveCloudMemory failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('saveCloudMemory error:', err);
    return false;
  }
}

export async function deleteCloudMemory(userId: string, memoryId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('ai_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId);
    if (error) {
      console.warn('deleteCloudMemory failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('deleteCloudMemory error:', err);
    return false;
  }
}

export async function getMemories(userId?: string): Promise<AIMemory[]> {
  if (userId) {
    const cloud = await loadCloudMemories(userId);
    if (cloud !== null) {
      return cloud;
    }
  }
  return loadLocalMemories();
}

export async function saveMemory(memory: AIMemory, userId?: string): Promise<void> {
  let savedToCloud = false;
  if (userId) {
    savedToCloud = await saveCloudMemory(userId, memory);
  }
  if (!savedToCloud) {
    saveLocalMemory(memory);
  }
}

export async function deleteMemory(memoryId: string, userId?: string): Promise<void> {
  if (userId) {
    await deleteCloudMemory(userId, memoryId);
  }
  deleteLocalMemory(memoryId);
}
