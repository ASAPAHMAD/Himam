/**
 * Generic data model — Phase 1 architecture refactor.
 *
 * These types replace the hardcoded `'PL-300' | 'PMI-PBA'` union and static
 * PL300_SECTIONS/PMIPBA_SECTIONS arrays described in ARCHITECTURE.md §2-3.
 *
 * Added alongside the legacy types in `../types.ts` — nothing legacy is
 * removed or changed in this step. The app continues to run on the legacy
 * model until each component is migrated (see ROADMAP.md Phase 1).
 *
 * Keep this file in sync with ARCHITECTURE.md §3. If they diverge, fix here
 * AND update the doc in the same change.
 */

export interface StudyWindow {
  label?: string;   // e.g. "Morning", "Lunch", "Evening", "Weekend"
  startTime: string; // "HH:MM", 24-hour
  endTime: string;   // "HH:MM", 24-hour
  /**
   * Derived from startTime/endTime, not user-entered directly — see
   * src/utils/time.ts's computeDurationMinutes(). Kept as a real field
   * (not computed on every read) because schedulingEngine.ts and every
   * other consumer already just reads `.minutes` as a plain number; storing
   * it avoids threading the computation through every call site for a
   * value that only actually changes when startTime/endTime does.
   */
  minutes: number;
}

export interface VacationRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export type LearningStyle = string;

/**
 * Named steps, not a positional index — same principle as lesson ids
 * (ARCHITECTURE.md §2): a step *order* can change later (reordering, adding
 * a step) without invalidating an in-progress user's saved position the way
 * a raw array index would.
 */
export type OnboardingStep = 'identity' | 'career' | 'certification' | 'schedule' | 'learning_style' | 'complete';

export type MilestoneType = 'Exam' | 'Graduation' | 'Certification' | 'Deadline' | 'Interview' | 'Personal Goal' | 'Other';

export interface Milestone {
  id: string;
  type: MilestoneType;
  title?: string;
  date: string; // YYYY-MM-DD
  completed?: boolean;
}

export interface InternshipApplication {
  id: string;
  company: string;
  position: string;
  location?: string;
  appliedDate?: string;
  status: 'applied' | 'interviewing' | 'offered' | 'rejected';
  interviewDate?: string;
  notes?: string;
}

export interface AcademicEvent {
  id: string;
  title: string;
  type: 'midterm' | 'final' | 'deadline' | 'presentation' | 'internship_start' | 'other';
  date: string;
  notes?: string;
}

export interface CourseProgressInfo {
  name: string;
  notes?: string;
  assignments?: string;
  examDates?: string;
  aiExplanation?: string;
}

export interface Profile {
  id: string;
  name: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  country: string;
  timezone: string;
  language?: 'en' | 'ar';
  careerGoal: string;
  currentJob: string;
  targetJob: string;
  currentSalary: string;
  targetSalary: string;
  isStudent?: boolean;
  university?: string;
  major?: string;
  academicYear?: string;
  currentSemester?: string;
  currentGpa?: string;
  currentCourses?: string;
  expectedGraduation?: string;
  internshipApps?: number;
  internshipInterviews?: number;
  internshipOffers?: number;
  internshipApplications?: InternshipApplication[];
  capstoneTopic?: string;
  capstoneStatus?: string;
  capstoneSupervisor?: string;
  capstoneDeadline?: string;
  capstoneDeliverables?: string;
  capstoneMilestones?: string;
  academicEvents?: AcademicEvent[];
  courseProgress?: Record<string, CourseProgressInfo>;
  learningGoals: string[];
  /**
   * Optional metadata for entries in `learningGoals`, keyed by the exact goal
   * string. Additive/optional — profiles saved before this field existed
   * simply have no entries here, and every reader treats a missing key as
   * "no category, no link, no course match" rather than an error. Lets a
   * custom-added goal (e.g. typed free-text during onboarding) carry a
   * category (matching the Suggested Goals Library's own categories) and an
   * optional course URL (Udemy/LinkedIn Learning/Coursera/etc.), without
   * requiring the full Course/Section/Lesson structure Course CRUD will
   * eventually provide for these.
   *
   * `courseId`, when set, means this goal corresponds to a real catalog
   * Course — every consumer (CourseCatalog, the scheduler, the AI context
   * builder, Dashboard) prefers this exact id match over fuzzy label-text
   * matching. Goals without a courseId (including all goals saved before
   * this field existed) fall back to the original fuzzy matching, unchanged.
   * This is an incremental step — see ARCHITECTURE.md's learning-goal
   * unification note for the later, dedicated migration that replaces
   * `learningGoals: string[]` with a first-class `LearningGoal` model once
   * every consumer prefers `courseId`.
   */
  learningGoalDetails?: Record<string, { 
    category?: string; 
    url?: string; 
    courseId?: string; 
    milestones?: Milestone[];
    isCustom?: boolean;
    description?: string;
    skills?: string[];
    estimatedHours?: number;
    difficulty?: string;
    customResources?: Array<{
      id: string;
      provider: string;
      name: string;
      url: string;
      type: string;
    }>;
  }>;
  workingDays: string[];
  biWeeklyEnabled?: boolean;
  workingDaysWeekB?: string[];
  vacationRanges: VacationRange[];
  holidays: string[]; // discrete non-working ISO dates
  extraWorkingDays: string[]; // discrete dates that ARE workable despite falling on a normally non-working weekday — the inverse of `holidays`
  studyWindows: StudyWindow[];
  /**
   * Optional — deliberately no default. A silently pre-selected style (the
   * previous behavior, always defaulting to 'Mixed') looks like a real
   * choice the learner made but didn't, and the AI Coach can't honestly
   * adapt to a preference nobody actually picked. Onboarding now requires
   * an explicit selection (see onboarding/validation.ts); cloud reads still
   * fall back to 'Mixed' only for rows saved before this field existed
   * (see models/cloudPersistence.ts) — not a new default for new profiles.
   */
  learningStyle?: LearningStyle;
  /**
   * Single source of truth for whether onboarding is done. Resumable: a user
   * who closes the app mid-flow returns to `onboardingStep`, not step one —
   * see models/profileMigration.ts for how existing (pre-onboarding-feature)
   * users are grandfathered in as already-complete rather than retroactively
   * interrupted by a wizard that didn't exist when they started using the app.
   */
  onboardingCompleted: boolean;
  onboardingStep: OnboardingStep;
  background?: string;
  scheduleMode?: 'automated' | 'manual';
  manualTasks?: { [date: string]: Array<{ id: string; title: string; duration: number; completed: boolean }> };
  manualLessons?: { [date: string]: string[] };
  dailyGoalMinutes?: number;
  customCourses?: CourseWithContent[];
}

export type CourseMode = 'ai' | 'manual' | 'imported';

export interface Course {
  id: string;
  name: string;
  mode: CourseMode;
  color: string;
  examDate: string | null;
  createdAt: string;
  /**
   * undefined/absent = shared platform content (today's only case — every
   * course currently comes from migrateLegacy.ts). A real user id = that
   * user's own course. Added in the v0.3.0 forward-compatibility pass
   * (see ARCHITECTURE.md §8.2) specifically so Course CRUD / AI generation /
   * imported courses (Phase 4+) need no schema change when they arrive —
   * only this field starts getting set to something other than undefined.
   */
  ownerId?: string;
  /**
   * Optional catalog-authored copy for Library/browse cards. Optional and
   * additive — existing Course objects without it keep working; consumers
   * fall back to an auto-generated summary (see courseDisplay.ts) when absent,
   * which is expected for AI-generated/imported courses that don't have
   * curated copy yet.
   */
  description?: string;
  /**
   * Optional catalog category label (e.g. "Professional Certification",
   * "University Degree", "Language"). Optional and additive, same fallback
   * treatment as `description`.
   */
  category?: string;
  difficulty?: string;
  estimatedHours?: number;
  provenance?: string; // e.g. 'AI Generated' | 'Microsoft Learn' | 'Udemy' | 'Manual' | 'Imported'
}

export interface Section {
  id: string;
  courseId: string;
  name: string;
  order: number;
}

export type LessonType =
  | 'video' | 'reading' | 'practice' | 'quiz'
  | 'revision' | 'flashcards' | 'lab' | 'assignment';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type ResourceType =
  | 'youtube' | 'microsoft_learn' | 'udemy' | 'coursera'
  | 'pdf' | 'book' | 'article' | 'github' | 'lab' | 'custom_url';

export interface Resource {
  id: string;
  type: ResourceType;
  title: string;
  url?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
}

export interface PracticeQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Lesson {
  id: string; // stable UUID — never positional (see ARCHITECTURE.md §2 on the old scheme)
  sectionId: string;
  title: string;
  description: string;
  type: LessonType;
  duration: number; // minutes
  difficulty: Difficulty;
  scheduledDate: string | null;
  resources: Resource[];
  attachments: Attachment[];
  practiceQuestions: PracticeQuestion[];
  aiSummary?: string;
  aiExplanation?: string;
  provenance?: string; // e.g. 'AI Generated' | 'Microsoft Learn' | 'Udemy' | 'Manual' | 'Imported'
}

export type LessonStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';
export type LessonPriority = 'Low' | 'Normal' | 'High';

/**
 * Per-user progress against lessons. Kept as keyed dictionaries (by lesson id)
 * for the same reason the legacy StudyPlanState was — see ARCHITECTURE.md §3.
 */
export interface UserProgress {
  lessonStatus: Record<string, LessonStatus>;
  bookmarks: Record<string, boolean>;
  difficultyRating: Record<string, number>; // user's personal 1-3 flag, distinct from Lesson.difficulty
  priority: Record<string, LessonPriority>;
  revisionDates: Record<string, string>;
  notes: Record<string, string>;
  completionDates: Record<string, string>;
  completionTimes: Record<string, string>;
  richNotes?: Record<string, any>;
}

/** A course together with its full section/lesson tree — the shape most UI reads. */
export interface CourseWithContent extends Course {
  sections: (Section & { lessons: Lesson[] })[];
}

export interface CourseDraft {
  id: string; // Draft ID
  goalName: string;
  name: string;
  createdAt: string; // ISOString
  lastModifiedAt: string; // ISOString
  mode: 'ai' | 'imported';
  description?: string;
  category?: string;
  difficulty?: string;
  estimatedHours?: number;
  directives?: string; // Original prompt user directives
  importUrl?: string;  // Original prompt import URL
  sections: Array<{
    id: string;
    name: string;
    lessons: Array<{
      id: string; // Stable UUID/identifier
      title: string;
      description: string;
      type: 'video' | 'reading' | 'practice' | 'quiz' | 'revision' | 'flashcards' | 'lab' | 'assignment';
      duration: number; // minutes
      difficulty: 'Easy' | 'Medium' | 'Hard';
      provenance?: string;
    }>;
  }>;
}

export type MemoryCategory = 'weakness' | 'strength' | 'preference' | 'habit' | 'goal' | 'milestone' | 'motivation';

export interface AIMemory {
  id: string;
  userId: string;
  category: MemoryCategory;
  importance: number; // 1-10
  confidence: number; // 0.0-1.0
  summary: string;
  source: string; // e.g. 'conversation'
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  expiresAt?: string | null; // ISO String
  lastUsedAt?: string | null; // ISO String
}

