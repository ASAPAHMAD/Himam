/**
 * Cloud Synchronization — SyncEngine foundation (Milestone 2.1).
 *
 * This module defines the contracts every later Cloud Sync milestone builds
 * on: the shape of a queued write (`SyncEntry`), the retry/backoff contract
 * (`SyncPolicy`), and the two pluggable dependencies `SyncEngine` is injected
 * with — `SyncOutboxStore` (Milestone 2.2 implements this against IndexedDB)
 * and `SyncTransport` (Milestone 2.3 implements this against Supabase).
 *
 * See CLOUD_SYNC_PROPOSAL.md §5a for the approved architecture this
 * implements. Nothing in this file talks to IndexedDB or Supabase — that is
 * intentionally out of scope for Milestone 2.1.
 */

/** The kinds of local mutations Cloud Sync knows how to queue and deliver. */
export type SyncEntityType = 'course_save' | 'lesson_progress' | 'profile_field';

/** A single queued write, pending delivery to Supabase. */
export interface SyncEntry {
  id: string;
  entityType: SyncEntityType;
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
  /**
   * When the most recent delivery attempt was made (Milestone 2.5) — used to
   * gate automatic retries against the backoff window computed by
   * `computeBackoffDelay`. Optional so entries persisted by earlier
   * milestones (before this field existed) still deserialize fine; a
   * missing value falls back to `createdAt` wherever it's read.
   */
  lastAttemptAt?: number;
}

export type SyncStatusName = 'idle' | 'pendingWrites' | 'draining' | 'blocked';

export interface SyncStatus {
  name: SyncStatusName;
  pendingCount: number;
  /**
   * The id of the entry currently being attempted, if any (Milestone 2.5).
   * Lets `computeSyncEntryState` report a precise per-entry "retrying" state
   * for the one entry actually in flight, rather than treating every queued
   * entry as "retrying" for the whole duration of a drain() call.
   */
  currentlyAttemptingId?: string;
}

/**
 * Retry policy, per CLOUD_SYNC_PROPOSAL.md §6 — configurable rather than a
 * hardcoded threshold, so tuning these numbers later doesn't require touching
 * retry logic.
 */
export interface SyncPolicy {
  retryCount: number;
  /** Base delay in ms between retry attempts. */
  retryInterval: number;
  backoff: 'fixed' | 'exponential';
  /** Whichever of these is reached first surfaces a "sync error" to the UI. */
  surfaceErrorAfter: {
    attempts?: number;
    elapsedMs?: number;
  };
}

export const DEFAULT_SYNC_POLICY: SyncPolicy = {
  retryCount: 3,
  retryInterval: 5000,
  backoff: 'exponential',
  surfaceErrorAfter: { attempts: 3, elapsedMs: 10 * 60 * 1000 },
};

/**
 * Pluggable queue storage. Milestone 2.2 implements this against IndexedDB so
 * queued writes survive offline and survive the tab closing. Nothing that
 * depends on this interface needs to change when that swap happens.
 */
export interface SyncOutboxStore {
  add(entry: SyncEntry): Promise<void>;
  update(entry: SyncEntry): Promise<void>;
  remove(id: string): Promise<void>;
  list(): Promise<SyncEntry[]>;
}

/**
 * Pluggable delivery mechanism. Milestone 2.3 implements this against
 * Supabase (course tree RPC, profile fields, etc.).
 */
export interface SyncTransport {
  send(entry: SyncEntry): Promise<void>;
}

/**
 * The public surface every consumer (App.tsx, components) is allowed to use.
 * Per CLOUD_SYNC_PROPOSAL.md §5a: no component or other service talks to the
 * outbox store or Supabase directly for queued writes — only through this.
 */
export interface SyncEngine {
  enqueue(entry: Omit<SyncEntry, 'id' | 'createdAt' | 'attempts'>): Promise<SyncEntry>;
  drain(): Promise<void>;
  retry(entryId: string): Promise<void>;
  cancel(entryId: string): Promise<void>;
  status(): SyncStatus;
  pending(): SyncEntry[];
  flush(): Promise<void>;
  /**
   * Subscribe to lifecycle events (Milestone 2.5) — the observer/subscription
   * mechanism recorded as a future enhancement at the end of Milestone 2.1,
   * so consumers can react to sync state changes without polling `status()`/
   * `pending()` in a loop. Returns an unsubscribe function.
   */
  on(listener: SyncEventListener): () => void;
}

/**
 * Lifecycle events a `SyncEngine` emits (Milestone 2.5). Named after the
 * explicit state-machine vocabulary requested during review — Pending,
 * Queued, Retrying, Synced, Failed, Cancelled — rather than boolean flags.
 * `synced` and `cancelled` are events, not persisted per-entry states,
 * because the entry is removed from the store the moment either happens;
 * see `syncEntryState.ts` for the states that ARE queryable from a still-
 * queued entry (`pending` / `queued` / `retrying` / `failed`).
 */
export type SyncLifecycleEvent =
  | { type: 'enqueued'; entry: SyncEntry }
  | { type: 'retrying'; entry: SyncEntry }
  | { type: 'synced'; entry: SyncEntry }
  | { type: 'failed'; entry: SyncEntry }
  | { type: 'cancelled'; entryId: string }
  | { type: 'statusChanged'; status: SyncStatus };

export type SyncEventListener = (event: SyncLifecycleEvent) => void;

export interface Lesson {
  id: string; // e.g., "pl300-s0-l1"
  title: string;
  duration: number; // minutes
  course: 'PL-300' | 'PMI-PBA';
  sectionName: string;
  sectionIndex: number;
  lessonIndex: number;
}

export interface CourseSection {
  sec: string;
  items: [string, number][];
  preDone?: number;
}

export interface WrongAnswer {
  id: string;
  question: string;
  topic?: string;
  whyWrong: string;
  correctAnswer: string;
  date: string;
}

export interface Assignment {
  id: string;
  title: string;
  course: string;
  type: 'Homework' | 'Quiz' | 'Exam' | 'Project' | 'Other';
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM, 24h
  difficulty: 'Easy' | 'Medium' | 'Hard';
  estimatedHours: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
  grade?: string; // e.g. "A+", "92"
  notes?: string;
  studyTimeLogged?: number; // accumulated study minutes
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface CodeSnippet {
  id: string;
  title: string;
  code: string;
  language: string;
}

export interface NoteLink {
  id: string;
  label: string;
  url: string;
}

export interface StudyDocument {
  id: string;
  name: string;
  type: 'pdf' | 'txt' | 'md' | 'image' | 'other';
  uploadedAt: string;
  size?: string;
  contentSummary?: string;
  extractedKeyPoints?: string[];
  flashcards?: Flashcard[];
}

export interface RichLessonNote {
  personalNotes: string;
  images: string[];
  codeSnippets: CodeSnippet[];
  links: NoteLink[];
  flashcards: Flashcard[];
  summary?: string;
  documents?: StudyDocument[];
}

export interface QuizAttempt {
  id: string;
  lessonId: string;
  questionId: string;
  questionText: string;
  correct: boolean;
  timeTaken: number; // in seconds
  difficulty: string; // 'Easy' | 'Medium' | 'Hard'
  confidence?: number; // 1-5 rating (optional)
  timestamp: string; // ISO String
}

export interface StudyPlanState {
  completedLessons: { [id: string]: boolean };
  bookmarks: { [id: string]: boolean };
  difficulty: { [id: string]: number }; // rating (1, 2, or 3)
  priority: { [id: string]: boolean };
  revisionDates: { [id: string]: string }; // key -> ISO date (YYYY-MM-DD)
  salary: {
    current: string;
    mid: string;
    target: string;
  };
  streak: number;
  bestStreak: number;
  lastStudyDate: string | null;
  studyLog: { [date: string]: number }; // date -> minutes
  lessonsLog: { [date: string]: number }; // date -> count
  interviewAnswers: { [questionId: number]: string };
  journal: WrongAnswer[];
  notes: { [id: string]: string };
  richNotes?: { [id: string]: RichLessonNote };
  completionDates?: { [id: string]: string }; // YYYY-MM-DD
  completionTimes?: { [id: string]: string }; // e.g., "07:35 AM"
  assignments?: Assignment[];
  quizAttempts?: QuizAttempt[];
}

