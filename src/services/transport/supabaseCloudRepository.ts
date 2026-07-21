import { supabase } from '../../lib/supabase';
import { CloudSyncRepository, CourseTreePayload, ProfileFieldPayload, LessonProgressPayload } from './cloudRepository';

/**
 * The minimal surface this repository needs from a database client —
 * deliberately narrow, not the full `SupabaseClient` type, so nothing that
 * depends on `CloudSyncRepository` (i.e. `SupabaseSyncTransport`, and
 * therefore `SyncEngine`) ever needs to know about supabase-js's full API,
 * only this. Any object exposing these two methods satisfies it, including
 * lightweight test doubles.
 */
export interface CloudDbClient {
  rpc(fn: string, params: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
    };
    upsert(values: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
  };
}

/**
 * Supabase-backed implementation of `CloudSyncRepository` (Milestone 2.3).
 *
 * This is the ONLY file that knows courses/sections/lessons persist via a
 * `save_course_tree` RPC, or that profile fields are columns on a `profiles`
 * table, or that lesson progress is a row in `user_progress`. All of that
 * schema knowledge stops here — `SupabaseSyncTransport` never sees it.
 *
 * `client` defaults to the app's shared `supabase` client
 * (`src/lib/supabase.ts`), which is `null` when unconfigured. Every method
 * below is a no-op when that's the case, matching the existing pattern in
 * `models/cloudPersistence.ts` (Phase 1.5) — the app keeps working exactly
 * as it does today for anyone signed out or without Supabase configured.
 *
 * The cast below bridges supabase-js's real (much larger) client type to the
 * narrow `CloudDbClient` shape this file actually calls. supabase-js's
 * `.rpc()` and `.from(table).update(...).eq(...)` / `.upsert(...)` chains
 * are `PromiseLike` at runtime, which is what `CloudDbClient` expects; the
 * cast exists only because TypeScript can't structurally verify that without
 * importing supabase-js's full builder types here, which would defeat the
 * point of keeping this interface deliberately narrow.
 */
export class SupabaseCloudRepository implements CloudSyncRepository {
  constructor(private client: CloudDbClient | null = supabase as unknown as CloudDbClient | null) {}

  /**
   * Requires the `save_course_tree` Postgres function from
   * `supabase/migrations/0004_course_tree_rpc.sql`. That migration has been
   * written and reviewed but not applied against any live database in this
   * environment (no Supabase credentials here) — it must be pushed
   * (`supabase db push`) before this call will succeed against a real
   * project. See that migration file for the RLS/security notes.
   */
  async saveCourseTree(payload: CourseTreePayload): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.rpc('save_course_tree', {
      payload: {
        course: payload.course,
        sections: payload.sections,
        lessons: payload.lessons,
      },
    });
    if (error) throw new Error(`saveCourseTree: ${error.message}`);
  }

  async saveProfileField(payload: ProfileFieldPayload): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client
      .from('profiles')
      .update({ [payload.column]: payload.value })
      .eq('id', payload.userId);
    if (error) throw new Error(`saveProfileField: ${error.message}`);
  }

  async saveLessonProgress(payload: LessonProgressPayload): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.from('user_progress').upsert({
      user_id: payload.userId,
      lesson_id: payload.lessonId,
      status: payload.status ?? 'not_started',
      bookmark: payload.bookmark ?? false,
      difficulty_rating: payload.difficultyRating ?? null,
      priority: payload.priority ?? null,
      revision_date: payload.revisionDate ?? null,
      notes: payload.notes ?? null,
      completion_date: payload.completionDate ?? null,
      completion_time: payload.completionTime ?? null,
    });
    if (error) throw new Error(`saveLessonProgress: ${error.message}`);
  }
}
