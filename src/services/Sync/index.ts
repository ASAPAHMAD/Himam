import {
  SyncEntry,
  SyncTransport,
  SyncOutboxStore,
  SyncPolicy,
  SyncStatus,
  SyncStatusName,
  SyncEventListener,
  SyncLifecycleEvent,
  DEFAULT_SYNC_POLICY,
  SyncEngine,
} from './types';

import { SupabaseSyncTransport } from '../transport/supabaseSyncTransport';

export * from './types';
export { SupabaseSyncTransport };
export * from '../transport/cloudRepository';

export type SyncEntryState = 'pending' | 'retrying' | 'queued' | 'failed';

// Mappings for profile field diffing
export const PROFILE_FIELD_MAPPINGS = [
  { field: 'name', column: 'name' },
  { field: 'avatarUrl', column: 'avatar_url' },
  { field: 'country', column: 'country' },
  { field: 'timezone', column: 'timezone' },
  { field: 'careerGoal', column: 'career_goal' },
  { field: 'currentJob', column: 'current_job' },
  { field: 'targetJob', column: 'target_job' },
  { field: 'currentSalary', column: 'current_salary' },
  { field: 'targetSalary', column: 'target_salary' },
  { field: 'language', column: 'language' },
  { field: 'learningGoals', column: 'certifications' },
  { field: 'learningGoalDetails', column: 'learning_goal_details' },
  { field: 'workingDays', column: 'working_days' },
  { field: 'vacationRanges', column: 'vacation_ranges' },
  { field: 'holidays', column: 'holidays' },
  { field: 'extraWorkingDays', column: 'extra_working_days' },
  { field: 'studyWindows', column: 'study_windows' },
  { field: 'learningStyle', column: 'learning_style' },
  { field: 'onboardingCompleted', column: 'onboarding_completed' },
  { field: 'onboardingStep', column: 'onboarding_step' },
];

function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!isDeepEqual(a[key], b[key])) return false;
  }
  return true;
}

function normalizeValue(field: string, val: any): any {
  if (field === 'avatarUrl') return val ?? null;
  if (field === 'learningStyle') return val ?? '';
  if (field === 'learningGoals') return val || [];
  if (field === 'learningGoalDetails') return val ?? {};
  return val;
}

export interface ProfileFieldDiff {
  field: string;
  payload: {
    userId: string;
    column: string;
    value: any;
  };
}

export function diffProfileFields(
  userId: string,
  previous: any,
  next: any
): ProfileFieldDiff[] {
  const diffs: ProfileFieldDiff[] = [];

  for (const mapping of PROFILE_FIELD_MAPPINGS) {
    const { field, column } = mapping;
    const prevRaw = previous[field];
    const nextRaw = next[field];

    const prevVal = normalizeValue(field, prevRaw);
    const nextVal = normalizeValue(field, nextRaw);

    if (!isDeepEqual(prevVal, nextVal)) {
      diffs.push({
        field,
        payload: {
          userId,
          column,
          value: nextVal,
        },
      });
    }
  }

  return diffs;
}

export async function enqueueProfileChanges(
  engine: any,
  userId: string,
  previous: any,
  next: any
): Promise<any[]> {
  const diffs = diffProfileFields(userId, previous, next);
  const entries = [];
  for (const diff of diffs) {
    const entry = await engine.enqueue({
      entityType: 'profile_field',
      payload: diff.payload,
    });
    entries.push(entry);
  }
  return entries;
}

export function isIndexedDbAvailable(): boolean {
  return typeof globalThis !== 'undefined' && !!globalThis.indexedDB;
}

export class IndexedDbOutboxStore implements SyncOutboxStore {
  private dbName = 'SyncDatabase';
  private storeName = 'outbox';
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const idb = globalThis.indexedDB;
      if (!idb) {
        reject(new Error('IndexedDB is not available'));
        return;
      }

      const request = idb.open(this.dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  async add(entry: SyncEntry): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.add(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || request.error);
    });
  }

  async update(entry: SyncEntry): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || request.error);
    });
  }

  async remove(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || request.error);
    });
  }

  async list(): Promise<SyncEntry[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result as SyncEntry[];
        results.sort((a, b) => a.createdAt - b.createdAt);
        resolve(results);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

export class InMemoryOutboxStore implements SyncOutboxStore {
  private entries = new Map<string, SyncEntry>();

  async add(entry: SyncEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }
  async update(entry: SyncEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }
  async remove(id: string): Promise<void> {
    this.entries.delete(id);
  }
  async list(): Promise<SyncEntry[]> {
    const arr = Array.from(this.entries.values());
    arr.sort((a, b) => a.createdAt - b.createdAt);
    return arr;
  }
}

export function getDefaultOutboxStore(): SyncOutboxStore {
  if (isIndexedDbAvailable()) {
    return new IndexedDbOutboxStore();
  } else {
    return new InMemoryOutboxStore();
  }
}

export function computeBackoffDelay(policy: SyncPolicy, attempts: number): number {
  if (attempts <= 0) return 0;
  if (policy.backoff === 'fixed') {
    return policy.retryInterval;
  }
  return policy.retryInterval * Math.pow(2, attempts - 1);
}

export function computeSyncEntryState(
  entry: SyncEntry,
  policy: SyncPolicy,
  currentlyAttemptingId: string | null | undefined
): SyncEntryState {
  if (currentlyAttemptingId && entry.id === currentlyAttemptingId) {
    return 'retrying';
  }

  const thresholdAttempts = policy.surfaceErrorAfter.attempts ?? Infinity;
  const thresholdElapsedMs = policy.surfaceErrorAfter.elapsedMs ?? Infinity;
  const elapsedMs = Date.now() - (entry.lastAttemptAt ?? entry.createdAt);

  if (entry.attempts >= thresholdAttempts || elapsedMs >= thresholdElapsedMs) {
    return 'failed';
  }

  if (entry.attempts === 0) {
    return 'pending';
  }

  return 'queued';
}

export interface SyncEngineOptions {
  store?: SyncOutboxStore;
  transport?: SyncTransport;
  policy?: SyncPolicy;
}

class DefaultSyncEngine implements SyncEngine {
  private store: SyncOutboxStore;
  private transport: SyncTransport | null;
  private policy: SyncPolicy;
  private listeners = new Set<SyncEventListener>();
  private currentlyAttemptingId: string | null = null;
  private isDraining = false;
  private cachedEntries: SyncEntry[] = [];

  constructor(options: SyncEngineOptions = {}) {
    this.store = options.store || getDefaultOutboxStore();
    this.transport = options.transport || null;
    this.policy = options.policy || DEFAULT_SYNC_POLICY;
    this.init();
  }

  private init() {
    this.store.list().then(entries => {
      this.cachedEntries = entries;
    }).catch(err => {
      console.error("Failed to load sync entries from store", err);
    });
  }

  private emit(event: SyncLifecycleEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  on(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async enqueue(entryInput: Omit<SyncEntry, 'id' | 'createdAt' | 'attempts'>): Promise<SyncEntry> {
    const id = 'sync_' + Math.random().toString(36).substring(2, 15);
    const entry: SyncEntry = {
      id,
      entityType: entryInput.entityType,
      payload: entryInput.payload,
      createdAt: Date.now(),
      attempts: 0,
    };
    await this.store.add(entry);
    this.cachedEntries.push(entry);
    this.emit({ type: 'enqueued', entry });
    this.emitStatusChanged();
    return entry;
  }

  private emitStatusChanged() {
    this.emit({ type: 'statusChanged', status: this.status() });
  }

  status(): SyncStatus {
    const pendingCount = this.cachedEntries.length;
    let name: SyncStatusName = 'idle';

    if (this.isDraining) {
      name = 'draining';
    } else if (pendingCount > 0) {
      const allFailed = this.cachedEntries.every(
        e => computeSyncEntryState(e, this.policy, null) === 'failed'
      );
      if (allFailed) {
        name = 'blocked';
      } else {
        name = 'pendingWrites';
      }
    }

    const s: SyncStatus = {
      name,
      pendingCount,
    };
    if (this.currentlyAttemptingId) {
      s.currentlyAttemptingId = this.currentlyAttemptingId;
    }
    return s;
  }

  pending(): SyncEntry[] {
    return this.cachedEntries;
  }

  async drain(): Promise<void> {
    if (this.isDraining) return;
    this.isDraining = true;
    this.emitStatusChanged();

    try {
      this.cachedEntries = await this.store.list();

      if (!this.transport) {
        for (const entry of this.cachedEntries) {
          entry.attempts++;
          entry.lastAttemptAt = Date.now();
          entry.lastError = 'Milestone 2.3: No transport configured';
          try {
            await this.store.update(entry);
          } catch (e) {
            console.error('Failed to update entry in store:', e);
          }
        }
        this.emitStatusChanged();
        return;
      }

      for (const entry of [...this.cachedEntries]) {
        const state = computeSyncEntryState(entry, this.policy, this.currentlyAttemptingId);
        
        if (state === 'failed') {
          continue;
        }

        if (state === 'queued') {
          const delay = computeBackoffDelay(this.policy, entry.attempts);
          const elapsed = Date.now() - (entry.lastAttemptAt ?? entry.createdAt);
          if (elapsed < delay) {
            continue;
          }
        }

        this.currentlyAttemptingId = entry.id;
        this.emit({ type: 'retrying', entry });
        this.emitStatusChanged();

        try {
          entry.attempts++;
          entry.lastAttemptAt = Date.now();
          
          await this.transport.send(entry);
          
          try {
            await this.store.remove(entry.id);
          } catch (e) {
            console.error('Failed to remove entry from store:', e);
          }
          this.cachedEntries = this.cachedEntries.filter(e => e.id !== entry.id);
          this.currentlyAttemptingId = null;
          this.emit({ type: 'synced', entry });
        } catch (error: any) {
          entry.lastError = error.message || String(error);
          try {
            await this.store.update(entry);
          } catch (e) {
            console.error('Failed to update entry in store:', e);
          }
          this.currentlyAttemptingId = null;
          
          const newState = computeSyncEntryState(entry, this.policy, null);
          if (newState === 'failed') {
            this.emit({ type: 'failed', entry });
          }
        }
        this.emitStatusChanged();
      }
    } finally {
      this.isDraining = false;
      this.emitStatusChanged();
    }
  }

  async retry(entryId: string): Promise<void> {
    const entries = await this.store.list();
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    if (!this.transport) {
      entry.attempts++;
      entry.lastAttemptAt = Date.now();
      entry.lastError = 'Milestone 2.3: No transport configured';
      await this.store.update(entry);
      this.cachedEntries = await this.store.list();
      this.emitStatusChanged();
      return;
    }

    this.currentlyAttemptingId = entry.id;
    this.emit({ type: 'retrying', entry });
    this.emitStatusChanged();

    try {
      entry.attempts++;
      entry.lastAttemptAt = Date.now();
      await this.transport.send(entry);
      await this.store.remove(entry.id);
      this.cachedEntries = this.cachedEntries.filter(e => e.id !== entry.id);
      this.currentlyAttemptingId = null;
      this.emit({ type: 'synced', entry });
    } catch (error: any) {
      entry.lastError = error.message || String(error);
      await this.store.update(entry);
      this.currentlyAttemptingId = null;
      const newState = computeSyncEntryState(entry, this.policy, null);
      if (newState === 'failed') {
        this.emit({ type: 'failed', entry });
      }
    }
    this.cachedEntries = await this.store.list();
    this.emitStatusChanged();
  }

  async cancel(entryId: string): Promise<void> {
    await this.store.remove(entryId);
    this.cachedEntries = this.cachedEntries.filter(e => e.id !== entryId);
    this.emit({ type: 'cancelled', entryId });
    this.emitStatusChanged();
  }

  async flush(): Promise<void> {
    return this.drain();
  }
}

export function createSyncEngine(options?: SyncEngineOptions): any {
  return new DefaultSyncEngine(options);
}

export class SyncScheduler {
  private timer: any = null;
  private intervalMs: number;

  constructor(private engine: any, options?: { periodicIntervalMs?: number }) {
    this.intervalMs = options?.periodicIntervalMs || 10000;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.engine.drain().catch((err: any) => {
        console.error('Periodic sync drain failed:', err);
      });
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export function evaluateSignOut(engine: any): { decision: 'proceed' | 'blockedPendingWrites'; pendingCount: number } {
  const pending = engine.pending();
  if (pending.length === 0) {
    return { decision: 'proceed', pendingCount: 0 };
  }
  return { decision: 'blockedPendingWrites', pendingCount: pending.length };
}

export async function attemptSyncThenSignOut(engine: any): Promise<{ decision: 'proceed' | 'blockedPendingWrites'; pendingCount: number }> {
  await engine.flush();
  return evaluateSignOut(engine);
}
