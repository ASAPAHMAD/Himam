import { Course, Section, Lesson, LessonStatus, LessonPriority } from '../../models/types';

/**
 * Payload shapes for each entity type SyncTransport knows how to route.
 * These describe *what* is being saved in application terms (a course tree,
 * a profile field, a lesson's progress) — not *how* it's stored. No table
 * names, column names, or RPC names appear here; that knowledge belongs
 * entirely to a `CloudSyncRepository` implementation.
 */

export interface CourseTreePayload {
  course: Course;
  sections: Section[];
  lessons: Lesson[];
}

/**
 * `column` is the already-resolved persistence-layer field name (e.g. a
 * snake_case DB column). Deciding *which* app-level Profile field maps to
 * which column is Milestone 2.4's job (Profile Synchronization) — this
 * milestone only needs the payload shape to exist so the transport can be
 * built and tested against it.
 */
export interface ProfileFieldPayload {
  userId: string;
  column: string;
  value: unknown;
}

export interface LessonProgressPayload {
  userId: string;
  lessonId: string;
  status?: LessonStatus;
  bookmark?: boolean;
  difficultyRating?: number | null;
  priority?: LessonPriority | null;
  revisionDate?: string | null;
  notes?: string | null;
  completionDate?: string | null;
  completionTime?: string | null;
}

/**
 * Repository / persistence-adapter abstraction between `SyncTransport` and
 * Supabase (Milestone 2.3, per explicit review requirement: "prefer a
 * repository or persistence adapter abstraction between transport and
 * Supabase rather than coupling the transport directly to database schema").
 *
 * `SupabaseSyncTransport` depends only on this interface. It has no idea
 * courses/sections/lessons live in tables with those names, that saving a
 * course goes through an RPC, or that profile fields are columns — all of
 * that lives in the concrete implementation (`SupabaseCloudRepository`), and
 * could be swapped for a different backend entirely without touching the
 * transport.
 */
export interface CloudSyncRepository {
  saveCourseTree(payload: CourseTreePayload): Promise<void>;
  saveProfileField(payload: ProfileFieldPayload): Promise<void>;
  saveLessonProgress(payload: LessonProgressPayload): Promise<void>;
}
