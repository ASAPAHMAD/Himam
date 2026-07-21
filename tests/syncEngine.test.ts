import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyncEngine, computeBackoffDelay, DEFAULT_SYNC_POLICY, SyncEntry, SyncTransport } from '../src/services/Sync';


class StubTransport implements SyncTransport {
  public sent: SyncEntry[] = [];
  constructor(private shouldFail: boolean) {}
  async send(entry: SyncEntry): Promise<void> {
    if (this.shouldFail) {
      throw new Error('stub transport: simulated failure');
    }
    this.sent.push(entry);
  }
}

test('enqueue adds an entry and reports pendingWrites status', async () => {
  const engine = createSyncEngine();
  assert.equal(engine.status().name, 'idle');

  await engine.enqueue({ entityType: 'course_save', payload: { title: 'Test Course' } });

  assert.equal(engine.status().name, 'pendingWrites');
  assert.equal(engine.pending().length, 1);
  assert.equal(engine.pending()[0].entityType, 'course_save');
  assert.equal(engine.pending()[0].attempts, 0);
});

test('drain() with no transport configured leaves entries pending (no syncing yet, by design)', async () => {
  const engine = createSyncEngine();
  await engine.enqueue({ entityType: 'lesson_progress', payload: { lessonId: 'lesson_abc' } });

  await engine.drain();

  // Milestone 2.1 scope: no real transport exists yet, so drain() cannot
  // succeed. The entry must remain queued, not be silently discarded.
  assert.equal(engine.pending().length, 1);
  assert.equal(engine.status().name, 'pendingWrites');
  assert.equal(engine.pending()[0].attempts, 1);
  assert.match(engine.pending()[0].lastError ?? '', /Milestone 2.3/);
});

test('drain() with a succeeding transport clears the queue', async () => {
  const transport = new StubTransport(false);
  const engine = createSyncEngine({ transport });

  await engine.enqueue({ entityType: 'profile_field', payload: { field: 'timezone', value: 'Asia/Riyadh' } });
  await engine.drain();

  assert.equal(engine.pending().length, 0);
  assert.equal(engine.status().name, 'idle');
  assert.equal(transport.sent.length, 1);
});

test('drain() with a failing transport keeps the entry and records the error', async () => {
  const transport = new StubTransport(true);
  const engine = createSyncEngine({ transport });

  await engine.enqueue({ entityType: 'course_save', payload: { title: 'Retry Me' } });
  await engine.drain();

  const [entry] = engine.pending();
  assert.equal(entry.attempts, 1);
  assert.match(entry.lastError ?? '', /simulated failure/);
});

test('retry() re-attempts a single entry by id', async () => {
  const transport = new StubTransport(true);
  const engine = createSyncEngine({ transport });

  const entry = await engine.enqueue({ entityType: 'course_save', payload: {} });
  await engine.retry(entry.id);
  assert.equal(engine.pending()[0].attempts, 1);

  // Flip the transport to succeed, retry again — entry should clear.
  (transport as unknown as { shouldFail: boolean }).shouldFail = false;
  await engine.retry(entry.id);
  assert.equal(engine.pending().length, 0);
});

test('cancel() removes a queued entry without attempting delivery', async () => {
  const engine = createSyncEngine();
  const entry = await engine.enqueue({ entityType: 'lesson_progress', payload: {} });
  await engine.cancel(entry.id);
  assert.equal(engine.pending().length, 0);
});

test('flush() is equivalent to drain()', async () => {
  const transport = new StubTransport(false);
  const engine = createSyncEngine({ transport });
  await engine.enqueue({ entityType: 'profile_field', payload: {} });
  await engine.flush();
  assert.equal(engine.pending().length, 0);
});

test('computeBackoffDelay: exponential backoff doubles per attempt', () => {
  const policy = { ...DEFAULT_SYNC_POLICY, backoff: 'exponential' as const, retryInterval: 1000 };
  assert.equal(computeBackoffDelay(policy, 1), 1000);
  assert.equal(computeBackoffDelay(policy, 2), 2000);
  assert.equal(computeBackoffDelay(policy, 3), 4000);
});

test('computeBackoffDelay: fixed backoff stays constant', () => {
  const policy = { ...DEFAULT_SYNC_POLICY, backoff: 'fixed' as const, retryInterval: 5000 };
  assert.equal(computeBackoffDelay(policy, 1), 5000);
  assert.equal(computeBackoffDelay(policy, 5), 5000);
});

test('computeBackoffDelay: zero attempts means no delay', () => {
  assert.equal(computeBackoffDelay(DEFAULT_SYNC_POLICY, 0), 0);
});
