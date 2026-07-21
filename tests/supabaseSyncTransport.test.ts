import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SupabaseSyncTransport,
  CloudSyncRepository,
  CourseTreePayload,
  ProfileFieldPayload,
  LessonProgressPayload,
  createSyncEngine,
  SyncEntry,
} from '../src/services/Sync';
import { SupabaseCloudRepository, CloudDbClient } from '../src/services/transport/supabaseCloudRepository';


/** Fake repository: records calls, no real Supabase involved. */
class FakeRepository implements CloudSyncRepository {
  public courseTreeSaved: CourseTreePayload[] = [];
  public profileFieldsSaved: ProfileFieldPayload[] = [];
  public lessonProgressSaved: LessonProgressPayload[] = [];
  constructor(private shouldFail = false) {}

  async saveCourseTree(payload: CourseTreePayload): Promise<void> {
    if (this.shouldFail) throw new Error('fake repository: simulated course save failure');
    this.courseTreeSaved.push(payload);
  }
  async saveProfileField(payload: ProfileFieldPayload): Promise<void> {
    if (this.shouldFail) throw new Error('fake repository: simulated profile field failure');
    this.profileFieldsSaved.push(payload);
  }
  async saveLessonProgress(payload: LessonProgressPayload): Promise<void> {
    if (this.shouldFail) throw new Error('fake repository: simulated progress failure');
    this.lessonProgressSaved.push(payload);
  }
}

const samplePayload: CourseTreePayload = {
  course: { id: 'course_1', name: 'Test Course', mode: 'ai', color: '#123456', examDate: null, createdAt: new Date().toISOString() },
  sections: [{ id: 'section_1', courseId: 'course_1', name: 'Section 1', order: 0 }],
  lessons: [{
    id: 'lesson_1', sectionId: 'section_1', title: 'Lesson 1', description: '', type: 'reading',
    duration: 10, difficulty: 'Easy', scheduledDate: null, resources: [], attachments: [], practiceQuestions: [],
  }],
};

test('SupabaseSyncTransport routes course_save entries to repository.saveCourseTree', async () => {
  const repo = new FakeRepository();
  const transport = new SupabaseSyncTransport(repo);
  const entry: SyncEntry = { id: 'e1', entityType: 'course_save', payload: samplePayload, createdAt: Date.now(), attempts: 0 };

  await transport.send(entry);

  assert.equal(repo.courseTreeSaved.length, 1);
  assert.equal(repo.courseTreeSaved[0].course.id, 'course_1');
  assert.equal(repo.profileFieldsSaved.length, 0);
  assert.equal(repo.lessonProgressSaved.length, 0);
});

test('SupabaseSyncTransport routes profile_field entries to repository.saveProfileField', async () => {
  const repo = new FakeRepository();
  const transport = new SupabaseSyncTransport(repo);
  const payload: ProfileFieldPayload = { userId: 'user_1', column: 'timezone', value: 'Asia/Riyadh' };
  const entry: SyncEntry = { id: 'e2', entityType: 'profile_field', payload, createdAt: Date.now(), attempts: 0 };

  await transport.send(entry);

  assert.equal(repo.profileFieldsSaved.length, 1);
  assert.equal(repo.profileFieldsSaved[0].column, 'timezone');
});

test('SupabaseSyncTransport routes lesson_progress entries to repository.saveLessonProgress', async () => {
  const repo = new FakeRepository();
  const transport = new SupabaseSyncTransport(repo);
  const payload: LessonProgressPayload = { userId: 'user_1', lessonId: 'lesson_1', status: 'completed' };
  const entry: SyncEntry = { id: 'e3', entityType: 'lesson_progress', payload, createdAt: Date.now(), attempts: 0 };

  await transport.send(entry);

  assert.equal(repo.lessonProgressSaved.length, 1);
  assert.equal(repo.lessonProgressSaved[0].status, 'completed');
});

test('SupabaseSyncTransport propagates repository failures (so SyncEngine retry logic still applies)', async () => {
  const repo = new FakeRepository(true);
  const transport = new SupabaseSyncTransport(repo);
  const entry: SyncEntry = { id: 'e4', entityType: 'course_save', payload: samplePayload, createdAt: Date.now(), attempts: 0 };

  await assert.rejects(() => transport.send(entry), /simulated course save failure/);
});

test('SyncEngine composes with SupabaseSyncTransport end-to-end: success drains the queue', async () => {
  const repo = new FakeRepository();
  const engine = createSyncEngine({ transport: new SupabaseSyncTransport(repo) });

  await engine.enqueue({ entityType: 'course_save', payload: samplePayload });
  await engine.drain();

  assert.equal(engine.pending().length, 0);
  assert.equal(repo.courseTreeSaved.length, 1);
});

test('SyncEngine composes with SupabaseSyncTransport end-to-end: failure keeps the entry queued and retried', async () => {
  const repo = new FakeRepository(true);
  const engine = createSyncEngine({ transport: new SupabaseSyncTransport(repo) });

  await engine.enqueue({ entityType: 'course_save', payload: samplePayload });
  await engine.drain();

  assert.equal(engine.pending().length, 1);
  assert.equal(engine.pending()[0].attempts, 1);
  assert.match(engine.pending()[0].lastError ?? '', /simulated course save failure/);
});

/* ---------- SupabaseCloudRepository against a fake DB client ---------- */

class FakeDbClient implements CloudDbClient {
  public rpcCalls: { fn: string; params: Record<string, unknown> }[] = [];
  public updateCalls: { table: string; values: Record<string, unknown>; column: string; value: unknown }[] = [];
  public upsertCalls: { table: string; values: Record<string, unknown> }[] = [];
  constructor(private errorMessage: string | null = null) {}

  rpc(fn: string, params: Record<string, unknown>) {
    this.rpcCalls.push({ fn, params });
    return Promise.resolve({ error: this.errorMessage ? { message: this.errorMessage } : null });
  }

  from(table: string) {
    return {
      update: (values: Record<string, unknown>) => ({
        eq: (column: string, value: unknown) => {
          this.updateCalls.push({ table, values, column, value });
          return Promise.resolve({ error: this.errorMessage ? { message: this.errorMessage } : null });
        },
      }),
      upsert: (values: Record<string, unknown>) => {
        this.upsertCalls.push({ table, values });
        return Promise.resolve({ error: this.errorMessage ? { message: this.errorMessage } : null });
      },
    };
  }
}

test('SupabaseCloudRepository.saveCourseTree calls the save_course_tree RPC with the full tree', async () => {
  const client = new FakeDbClient();
  const repo = new SupabaseCloudRepository(client);

  await repo.saveCourseTree(samplePayload);

  assert.equal(client.rpcCalls.length, 1);
  assert.equal(client.rpcCalls[0].fn, 'save_course_tree');
  assert.equal((client.rpcCalls[0].params.payload as CourseTreePayload).course.id, 'course_1');
});

test('SupabaseCloudRepository.saveCourseTree throws when the RPC returns an error', async () => {
  const client = new FakeDbClient('permission denied');
  const repo = new SupabaseCloudRepository(client);

  await assert.rejects(() => repo.saveCourseTree(samplePayload), /permission denied/);
});

test('SupabaseCloudRepository.saveProfileField updates the given column for the given user', async () => {
  const client = new FakeDbClient();
  const repo = new SupabaseCloudRepository(client);

  await repo.saveProfileField({ userId: 'user_1', column: 'timezone', value: 'Asia/Riyadh' });

  assert.equal(client.updateCalls.length, 1);
  assert.equal(client.updateCalls[0].table, 'profiles');
  assert.deepEqual(client.updateCalls[0].values, { timezone: 'Asia/Riyadh' });
  assert.equal(client.updateCalls[0].column, 'id');
  assert.equal(client.updateCalls[0].value, 'user_1');
});

test('SupabaseCloudRepository.saveLessonProgress upserts a single user_progress row', async () => {
  const client = new FakeDbClient();
  const repo = new SupabaseCloudRepository(client);

  await repo.saveLessonProgress({ userId: 'user_1', lessonId: 'lesson_1', status: 'completed', bookmark: true });

  assert.equal(client.upsertCalls.length, 1);
  assert.equal(client.upsertCalls[0].table, 'user_progress');
  assert.equal(client.upsertCalls[0].values.user_id, 'user_1');
  assert.equal(client.upsertCalls[0].values.lesson_id, 'lesson_1');
  assert.equal(client.upsertCalls[0].values.status, 'completed');
  assert.equal(client.upsertCalls[0].values.bookmark, true);
});

test('SupabaseCloudRepository is a no-op when client is null (unconfigured Supabase)', async () => {
  const repo = new SupabaseCloudRepository(null);
  // None of these should throw — matches the existing cloudPersistence.ts
  // no-op-safe pattern for an unconfigured/signed-out environment.
  await repo.saveCourseTree(samplePayload);
  await repo.saveProfileField({ userId: 'user_1', column: 'timezone', value: 'x' });
  await repo.saveLessonProgress({ userId: 'user_1', lessonId: 'lesson_1' });
});
