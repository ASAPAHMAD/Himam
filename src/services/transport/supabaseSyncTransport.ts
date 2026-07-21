import { SyncEntry, SyncTransport } from '../Sync/types';
import { CloudSyncRepository, CourseTreePayload, ProfileFieldPayload, LessonProgressPayload } from './cloudRepository';
import { SupabaseCloudRepository } from './supabaseCloudRepository';

/**
 * SyncTransport implementation that delivers queued entries to Supabase via
 * a `CloudSyncRepository` (Milestone 2.3).
 *
 * This class knows nothing about database schema, RPC names, or table
 * structure — it only knows how to route a `SyncEntry` by `entityType` to
 * the matching repository method. All persistence-specific knowledge lives
 * in the injected `CloudSyncRepository` (`SupabaseCloudRepository` by
 * default, or any other implementation swapped in later for a different
 * backend). That separation is this milestone's explicit requirement: keep
 * transport independent of persistence details.
 *
 * Not wired into `DefaultSyncEngine`'s default, and not constructed anywhere
 * in `App.tsx`/`MyLearning.tsx`/any component — per this milestone's scope,
 * no application-component integration yet.
 */
export class SupabaseSyncTransport implements SyncTransport {
  constructor(private repository: CloudSyncRepository = new SupabaseCloudRepository()) {}

  async send(entry: SyncEntry): Promise<void> {
    switch (entry.entityType) {
      case 'course_save':
        return this.repository.saveCourseTree(entry.payload as CourseTreePayload);
      case 'profile_field':
        return this.repository.saveProfileField(entry.payload as ProfileFieldPayload);
      case 'lesson_progress':
        return this.repository.saveLessonProgress(entry.payload as LessonProgressPayload);
      default: {
        const exhaustiveCheck: never = entry.entityType;
        throw new Error(`SupabaseSyncTransport: unknown entity type "${exhaustiveCheck}"`);
      }
    }
  }
}
