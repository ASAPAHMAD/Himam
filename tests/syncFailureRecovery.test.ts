import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSyncEngine,
  computeSyncEntryState,
  DEFAULT_SYNC_POLICY,
  SyncEntry,
  SyncTransport,
  SyncOutboxStore,
  SyncScheduler,
  evaluateSignOut,
  attemptSyncThenSignOut,
} from '../src/services/Sync';


class CountingFailingTransport implements SyncTransport {
  public callCount = 0;
  async send(_entry: SyncEntry): Promise<void> {
    this.callCount++;
    throw new Error('simulated failure');
  }
}

class SucceedingTransport implements SyncTransport {
  public callCount = 0;
  async send(_entry: SyncEntry): Promise<void> {
    this.callCount++;
  }
}

/* ---------- Backoff-gated automatic retry ---------- */

test('drain() does not re-attempt an entry before its backoff window has elapsed', async () => {
  const transport = new CountingFailingTransport();
  const policy = { ...DEFAULT_SYNC_POLICY, backoff: 'fixed' as const, retryInterval: 100 };
  const engine = createSyncEngine({ transport, policy });

  await engine.enqueue({ entityType: 'course_save', payload: {} });
  await engine.drain(); // first attempt: attempts 0 -> 1, always allowed
  assert.equal(transport.callCount, 1);

  await engine.drain(); // immediately again: backoff (100ms) hasn't elapsed
  assert.equal(transport.callCount, 1, 'should not have re-attempted before backoff elapsed');

  await new Promise((resolve) => setTimeout(resolve, 120));
  await engine.drain(); // now backoff has elapsed
  assert.equal(transport.callCount, 2);
});

test('drain() stops auto-retrying an entry once it crosses the failure threshold', async () => {
  const transport = new CountingFailingTransport();
  const policy = {
    ...DEFAULT_SYNC_POLICY,
    backoff: 'fixed' as const,
    retryInterval: 10,
    surfaceErrorAfter: { attempts: 2 },
  };
  const engine = createSyncEngine({ transport, policy });
  await engine.enqueue({ entityType: 'course_save', payload: {} });

  await engine.drain(); // attempts -> 1
  await new Promise((resolve) => setTimeout(resolve, 20));
  await engine.drain(); // attempts -> 2, crosses threshold (>=2)
  assert.equal(transport.callCount, 2);

  await new Promise((resolve) => setTimeout(resolve, 20));
  await engine.drain(); // should be skipped now — threshold crossed
  assert.equal(transport.callCount, 2, 'auto-retry should have stopped after crossing the failure threshold');
});

test('retry() bypasses backoff and the failure threshold entirely (manual override)', async () => {
  const transport = new CountingFailingTransport();
  const policy = { ...DEFAULT_SYNC_POLICY, backoff: 'fixed' as const, retryInterval: 100_000, surfaceErrorAfter: { attempts: 1 } };
  const engine = createSyncEngine({ transport, policy });
  const entry = await engine.enqueue({ entityType: 'course_save', payload: {} });

  await engine.drain(); // attempts -> 1, already past threshold, huge backoff window
  assert.equal(transport.callCount, 1);

  // A manual retry should still go through immediately despite both guards.
  await engine.retry(entry.id);
  assert.equal(transport.callCount, 2);
});

/* ---------- Store failure handling ---------- */

class FlakyStore implements SyncOutboxStore {
  private entries = new Map<string, SyncEntry>();
  public removeShouldFail = false;
  public updateShouldFail = false;

  async add(entry: SyncEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }
  async update(entry: SyncEntry): Promise<void> {
    if (this.updateShouldFail) throw new Error('simulated store update failure');
    this.entries.set(entry.id, entry);
  }
  async remove(id: string): Promise<void> {
    if (this.removeShouldFail) throw new Error('simulated store remove failure');
    this.entries.delete(id);
  }
  async list(): Promise<SyncEntry[]> {
    return Array.from(this.entries.values());
  }
}

test('drain() continues past a store.remove() failure without throwing', async () => {
  const store = new FlakyStore();
  store.removeShouldFail = true;
  const transport = new SucceedingTransport();
  const engine = createSyncEngine({ store, transport });

  await engine.enqueue({ entityType: 'course_save', payload: { a: 1 } });
  await engine.enqueue({ entityType: 'course_save', payload: { a: 2 } });

  await assert.doesNotReject(() => engine.drain());
  // Transport succeeded for both, but remove() failed, so entries are still
  // technically present in the store — drain() shouldn't have crashed.
  assert.equal(transport.callCount, 2);
});

test('drain() continues past a store.update() failure without throwing', async () => {
  const store = new FlakyStore();
  store.updateShouldFail = true;
  const transport = new CountingFailingTransport();
  const engine = createSyncEngine({ store, transport });

  await engine.enqueue({ entityType: 'course_save', payload: {} });
  await assert.doesNotReject(() => engine.drain());
  assert.equal(transport.callCount, 1);
});

/* ---------- Explicit per-entry state machine ---------- */

test('computeSyncEntryState: a fresh, never-attempted entry is pending', () => {
  const entry: SyncEntry = { id: 'e1', entityType: 'course_save', payload: {}, createdAt: Date.now(), attempts: 0 };
  assert.equal(computeSyncEntryState(entry, DEFAULT_SYNC_POLICY, null), 'pending');
});

test('computeSyncEntryState: an entry currently being attempted is retrying', () => {
  const entry: SyncEntry = { id: 'e2', entityType: 'course_save', payload: {}, createdAt: Date.now(), attempts: 1, lastAttemptAt: Date.now() };
  assert.equal(computeSyncEntryState(entry, DEFAULT_SYNC_POLICY, 'e2'), 'retrying');
});

test('computeSyncEntryState: a failed-but-not-in-flight entry that has retried before is queued', () => {
  const entry: SyncEntry = { id: 'e3', entityType: 'course_save', payload: {}, createdAt: Date.now(), attempts: 1, lastAttemptAt: Date.now() };
  assert.equal(computeSyncEntryState(entry, DEFAULT_SYNC_POLICY, null), 'queued');
});

test('computeSyncEntryState: an entry past the surfaceErrorAfter threshold is failed', () => {
  const policy = { ...DEFAULT_SYNC_POLICY, surfaceErrorAfter: { attempts: 2 } };
  const entry: SyncEntry = { id: 'e4', entityType: 'course_save', payload: {}, createdAt: Date.now(), attempts: 3, lastAttemptAt: Date.now() };
  assert.equal(computeSyncEntryState(entry, policy, null), 'failed');
});

test('computeSyncEntryState: currentlyAttemptingId takes precedence even over failed', () => {
  const policy = { ...DEFAULT_SYNC_POLICY, surfaceErrorAfter: { attempts: 1 } };
  const entry: SyncEntry = { id: 'e5', entityType: 'course_save', payload: {}, createdAt: Date.now(), attempts: 5, lastAttemptAt: Date.now() };
  assert.equal(computeSyncEntryState(entry, policy, 'e5'), 'retrying');
});

/* ---------- Lifecycle events (observer pattern) ---------- */

test('SyncEngine emits enqueued, retrying, and synced events on a successful flow', async () => {
  const transport = new SucceedingTransport();
  const engine = createSyncEngine({ transport });
  const events: string[] = [];
  engine.on((e) => events.push(e.type));

  const entry = await engine.enqueue({ entityType: 'course_save', payload: {} });
  await engine.drain();

  assert.ok(events.includes('enqueued'));
  assert.ok(events.includes('retrying'));
  assert.ok(events.includes('synced'));
  assert.ok(events.includes('statusChanged'));
  void entry;
});

test('SyncEngine emits a failed event once the threshold is crossed, not before', async () => {
  const transport = new CountingFailingTransport();
  const policy = { ...DEFAULT_SYNC_POLICY, backoff: 'fixed' as const, retryInterval: 10, surfaceErrorAfter: { attempts: 2 } };
  const engine = createSyncEngine({ transport, policy });
  const failedEvents: unknown[] = [];
  engine.on((e) => {
    if (e.type === 'failed') failedEvents.push(e);
  });

  await engine.enqueue({ entityType: 'course_save', payload: {} });
  await engine.drain(); // attempts -> 1, below threshold
  assert.equal(failedEvents.length, 0);

  await new Promise((resolve) => setTimeout(resolve, 20));
  await engine.drain(); // attempts -> 2, crosses threshold
  assert.equal(failedEvents.length, 1);
});

test('SyncEngine emits a cancelled event on cancel()', async () => {
  const engine = createSyncEngine();
  const events: string[] = [];
  engine.on((e) => events.push(e.type));

  const entry = await engine.enqueue({ entityType: 'course_save', payload: {} });
  await engine.cancel(entry.id);

  assert.ok(events.includes('cancelled'));
  assert.equal(engine.pending().length, 0);
});

test('on() returns an unsubscribe function that actually stops delivery', async () => {
  const engine = createSyncEngine();
  const events: string[] = [];
  const unsubscribe = engine.on((e) => events.push(e.type));
  unsubscribe();

  await engine.enqueue({ entityType: 'course_save', payload: {} });
  assert.equal(events.length, 0);
});

test('status() reports currentlyAttemptingId only while that entry is in flight', async () => {
  let capturedDuringSend: string | undefined;
  class InspectingTransport implements SyncTransport {
    async send(entry: SyncEntry): Promise<void> {
      capturedDuringSend = engine.status().currentlyAttemptingId;
      throw new Error('fail to keep it simple');
    }
  }
  const engine = createSyncEngine({ transport: new InspectingTransport() });
  const entry = await engine.enqueue({ entityType: 'course_save', payload: {} });
  await engine.drain();

  assert.equal(capturedDuringSend, entry.id);
  assert.equal(engine.status().currentlyAttemptingId, undefined, 'should be cleared once the attempt finishes');
});

/* ---------- SyncScheduler ---------- */

test('SyncScheduler periodically drains while entries are pending', async () => {
  const transport = new SucceedingTransport();
  const engine = createSyncEngine({ transport });
  await engine.enqueue({ entityType: 'course_save', payload: {} });

  const scheduler = new SyncScheduler(engine, { periodicIntervalMs: 20 });
  scheduler.start();

  await new Promise((resolve) => setTimeout(resolve, 60));
  scheduler.stop();

  assert.ok(transport.callCount >= 1, 'expected the periodic timer to have triggered at least one drain');
  assert.equal(engine.pending().length, 0);
});

test('SyncScheduler.stop() prevents further drains', async () => {
  const transport = new SucceedingTransport();
  const engine = createSyncEngine({ transport });
  const scheduler = new SyncScheduler(engine, { periodicIntervalMs: 15 });
  scheduler.start();
  scheduler.stop();

  await engine.enqueue({ entityType: 'course_save', payload: {} });
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(transport.callCount, 0, 'no drain should have run after stop()');
  assert.equal(engine.pending().length, 1);
});

test('SyncScheduler.start() is safe in a Node environment with no window/document', () => {
  const engine = createSyncEngine();
  const scheduler = new SyncScheduler(engine, { periodicIntervalMs: 1000 });
  assert.doesNotThrow(() => scheduler.start());
  scheduler.stop();
});

/* ---------- Sign-out guard ---------- */

test('evaluateSignOut proceeds when nothing is pending', async () => {
  const engine = createSyncEngine();
  const result = evaluateSignOut(engine);
  assert.equal(result.decision, 'proceed');
  assert.equal(result.pendingCount, 0);
});

test('evaluateSignOut blocks when writes are pending', async () => {
  const engine = createSyncEngine(); // default NoopTransport — nothing ever succeeds
  await engine.enqueue({ entityType: 'course_save', payload: {} });

  const result = evaluateSignOut(engine);
  assert.equal(result.decision, 'blockedPendingWrites');
  assert.equal(result.pendingCount, 1);
});

test('attemptSyncThenSignOut proceeds after a successful flush', async () => {
  const transport = new SucceedingTransport();
  const engine = createSyncEngine({ transport });
  await engine.enqueue({ entityType: 'course_save', payload: {} });

  const result = await attemptSyncThenSignOut(engine);
  assert.equal(result.decision, 'proceed');
});

test('attemptSyncThenSignOut remains blocked if the flush could not clear everything', async () => {
  const transport = new CountingFailingTransport();
  const engine = createSyncEngine({ transport });
  await engine.enqueue({ entityType: 'course_save', payload: {} });

  const result = await attemptSyncThenSignOut(engine);
  assert.equal(result.decision, 'blockedPendingWrites');
  assert.equal(result.pendingCount, 1);
});
