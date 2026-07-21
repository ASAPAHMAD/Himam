/**
 * Cloud persistence — Phase 1.5 (Identity & Persistence Layer).
 *
 * Deliberately simple, per approved scope (ARCHITECTURE.md §8.4): no diffing,
 * no write queue, no retry/backoff, no offline handling. Every save is a
 * straightforward upsert of the full current Profile / UserProgress; every
 * load is a straightforward select. If a write fails (network blip, etc.) it
 * fails silently to the console and local state — which the UI already reads
 * from — is unaffected. That's the accepted trade-off of this phase; a real
 * sync engine with retries is explicitly out of scope.
 *
 * Every function is a no-op-safe when `supabase` is null (unconfigured) or
 * there's no signed-in user — the app must keep working exactly as it did in
 * Phase 1 for anyone not using an account.
 */
import { supabase } from '../lib/supabase';
import { Profile, UserProgress, LessonStatus, LessonPriority } from './types';

/* ---------- Profile <-> DB row mapping ----------
 * NOTE: `Profile.learningGoalDetails` (per-goal category/URL metadata) is
 * intentionally NOT part of this mapping yet — it's local-only for now,
 * same trade-off already made for AI Coach conversation history
 * (models/aiCoachHistory.ts). Adding a `learning_goal_details` jsonb column
 * + a new supabase/migrations/*.sql file is the natural follow-up, not
 * done here to avoid an unrequested schema migration. Not an oversight.
 */

interface ProfileRow {
  id: string;
  name: string;
  avatar_url: string | null;
  country: string;
  timezone: string;
  career_goal: string;
  current_job: string;
  target_job: string;
  current_salary: string;
  target_salary: string;
  language?: string;
  certifications: string[];
  learning_goal_details?: Record<string, any>;
  working_days: string[];
  vacation_ranges: { start: string; end: string }[];
  holidays: string[];
  extra_working_days: string[];
  study_windows: { label?: string; startTime: string; endTime: string; minutes: number }[];
  learning_style: string;
  onboarding_completed: boolean;
  onboarding_step: string;
}

export function profileToRow(userId: string, profile: Profile): ProfileRow {
  return {
    id: userId,
    name: profile.name,
    avatar_url: profile.avatarUrl ?? null,
    country: profile.country,
    timezone: profile.timezone,
    career_goal: profile.careerGoal,
    current_job: profile.currentJob,
    target_job: profile.targetJob,
    current_salary: profile.currentSalary,
    target_salary: profile.targetSalary,
    language: profile.language ?? 'en',
    certifications: profile.learningGoals || [],
    learning_goal_details: profile.learningGoalDetails ?? {},
    working_days: profile.workingDays,
    vacation_ranges: profile.vacationRanges,
    holidays: profile.holidays,
    extra_working_days: profile.extraWorkingDays,
    study_windows: profile.studyWindows,
    // Optional on Profile now (see models/types.ts) — write '' when unset
    // rather than changing this column's type; rowToProfile below treats
    // '' the same as a genuinely missing value on read.
    learning_style: profile.learningStyle ?? '',
    onboarding_completed: profile.onboardingCompleted,
    onboarding_step: profile.onboardingStep,
  };
}

export function rowToProfile(row: ProfileRow): Profile {
  // Conditionally-spread rather than `learningStyle: value | undefined` —
  // an object literal with `learningStyle: undefined` still has the key
  // present (Object.keys includes it), which would make a cloud-loaded
  // profile with no style set structurally different from a fresh
  // DEFAULT_PROFILE (which omits the key entirely when unset). Omitting
  // the key here too keeps both shapes identical, not just both "falsy".
  const learningStyle = (row.learning_style || undefined) as Profile['learningStyle'] | undefined;

  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url ?? undefined,
    country: row.country,
    timezone: row.timezone,
    careerGoal: row.career_goal,
    currentJob: row.current_job,
    targetJob: row.target_job,
    currentSalary: row.current_salary,
    targetSalary: row.target_salary,
    language: (row.language as 'en' | 'ar') ?? 'en',
    learningGoals: row.certifications ?? [],
    learningGoalDetails: row.learning_goal_details ?? {},
    workingDays: row.working_days ?? [],
    vacationRanges: row.vacation_ranges ?? [],
    holidays: row.holidays ?? [],
    extraWorkingDays: row.extra_working_days ?? [],
    studyWindows: row.study_windows ?? [],
    ...(learningStyle ? { learningStyle } : {}),
    onboardingCompleted: row.onboarding_completed ?? false,
    onboardingStep: (row.onboarding_step as Profile['onboardingStep']) ?? 'identity',
  };
}

export async function hasCloudProfile(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (error) { console.error('hasCloudProfile:', error.message); return false; }
  return Boolean(data);
}

export async function loadCloudProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) { console.error('loadCloudProfile:', error.message); return null; }
  return data ? rowToProfile(data as ProfileRow) : null;
}

export async function saveCloudProfile(userId: string, profile: Profile): Promise<void> {
  if (!supabase) return;
  const row = profileToRow(userId, profile);
  const { error } = await supabase.from('profiles').upsert(row);
  if (error) {
    const msg = error.message.toLowerCase();
    // If language or learning_goal_details columns are missing in the schema cache, filter them out and retry
    if (msg.includes('language') || msg.includes('learning_goal_details') || msg.includes('column') || msg.includes('cache') || msg.includes('not found')) {
      const safeRow: any = { ...row };
      if (msg.includes('language')) {
        delete safeRow.language;
      }
      if (msg.includes('learning_goal_details') || msg.includes('learning_goal')) {
        delete safeRow.learning_goal_details;
      }
      // If we're retrying, try to delete both if they are problematic or we're not sure which column triggered it
      const { error: retryError } = await supabase.from('profiles').upsert(safeRow);
      if (retryError) {
        // Try deleting both just in case
        const bareRow = { ...row };
        delete bareRow.language;
        delete bareRow.learning_goal_details;
        const { error: bareError } = await supabase.from('profiles').upsert(bareRow);
        if (bareError) {
          console.error('saveCloudProfile:', bareError.message);
        } else {
          console.log('saveCloudProfile: Successfully saved profile with fallback (omitted language and learning_goal_details columns).');
        }
      } else {
        console.log('saveCloudProfile: Successfully saved profile with fallback (omitted problematic columns).');
      }
    } else {
      console.error('saveCloudProfile:', error.message);
    }
  }
}

/* ---------- UserProgress <-> DB rows mapping ---------- */

interface ProgressRow {
  user_id: string;
  lesson_id: string;
  status: LessonStatus;
  bookmark: boolean;
  difficulty_rating: number | null;
  priority: LessonPriority | null;
  revision_date: string | null;
  notes: string | null;
  completion_date: string | null;
  completion_time: string | null;
}

export function progressToRows(userId: string, progress: UserProgress): ProgressRow[] {
  const lessonIds = new Set<string>([
    ...Object.keys(progress.lessonStatus),
    ...Object.keys(progress.bookmarks),
    ...Object.keys(progress.difficultyRating),
    ...Object.keys(progress.priority),
    ...Object.keys(progress.revisionDates),
    ...Object.keys(progress.notes),
    ...Object.keys(progress.completionDates),
    ...Object.keys(progress.completionTimes),
  ]);

  return [...lessonIds].map(lessonId => ({
    user_id: userId,
    lesson_id: lessonId,
    status: progress.lessonStatus[lessonId] ?? 'not_started',
    bookmark: progress.bookmarks[lessonId] ?? false,
    difficulty_rating: progress.difficultyRating[lessonId] ?? null,
    priority: progress.priority[lessonId] ?? null,
    revision_date: progress.revisionDates[lessonId] ?? null,
    notes: progress.notes[lessonId] ?? null,
    completion_date: progress.completionDates[lessonId] ?? null,
    completion_time: progress.completionTimes[lessonId] ?? null,
  }));
}

export function rowsToProgress(rows: ProgressRow[]): UserProgress {
  const progress: UserProgress = {
    lessonStatus: {}, bookmarks: {}, difficultyRating: {}, priority: {},
    revisionDates: {}, notes: {}, completionDates: {}, completionTimes: {},
  };
  for (const row of rows) {
    if (row.status && row.status !== 'not_started') progress.lessonStatus[row.lesson_id] = row.status;
    if (row.bookmark) progress.bookmarks[row.lesson_id] = true;
    if (row.difficulty_rating !== null) progress.difficultyRating[row.lesson_id] = row.difficulty_rating;
    if (row.priority) progress.priority[row.lesson_id] = row.priority;
    if (row.revision_date) progress.revisionDates[row.lesson_id] = row.revision_date;
    if (row.notes) progress.notes[row.lesson_id] = row.notes;
    if (row.completion_date) progress.completionDates[row.lesson_id] = row.completion_date;
    if (row.completion_time) progress.completionTimes[row.lesson_id] = row.completion_time;
  }
  return progress;
}

export async function loadCloudProgress(userId: string): Promise<UserProgress> {
  const empty: UserProgress = {
    lessonStatus: {}, bookmarks: {}, difficultyRating: {}, priority: {},
    revisionDates: {}, notes: {}, completionDates: {}, completionTimes: {},
  };
  if (!supabase) return empty;
  const { data, error } = await supabase.from('user_progress').select('*').eq('user_id', userId);
  if (error) { console.error('loadCloudProgress:', error.message); return empty; }
  return rowsToProgress((data ?? []) as ProgressRow[]);
}

/**
 * Bulk upsert of every lesson that has any progress. Simple by design (see
 * file header) — not incremental. Fine at this data volume (well under 200
 * lessons); revisit only if/when this phase's simplicity trade-off is
 * revisited on purpose.
 */
export async function saveCloudProgress(userId: string, progress: UserProgress): Promise<void> {
  if (!supabase) return;
  const rows = progressToRows(userId, progress);
  if (rows.length === 0) return;
  const { error } = await supabase.from('user_progress').upsert(rows);
  if (error) console.error('saveCloudProgress:', error.message);
}

/**
 * One-time local -> cloud migration, run only when a user signs in and has no
 * `profiles` row yet (see hasCloudProfile). Not a merge — this account has no
 * cloud data yet, so "push everything local up once" is unambiguous and safe.
 */
export async function migrateLocalToCloud(userId: string, profile: Profile, progress: UserProgress): Promise<void> {
  await saveCloudProfile(userId, { ...profile, id: userId });
  await saveCloudProgress(userId, progress);
}
