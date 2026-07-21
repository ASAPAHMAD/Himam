/**
 * One-time legacy → generic migration.
 *
 * Converts the static PL300_SECTIONS/PMIPBA_SECTIONS arrays (src/data.ts) into
 * generic Course/Section/Lesson entities (ARCHITECTURE.md §3), and the legacy
 * StudyPlanState (src/types.ts) into the generic UserProgress shape.
 *
 * Design decision — why lesson IDs are NOT regenerated:
 * Every legacy lesson id (`pl300-s0-l1`, `pmipba-s2-l4`, ...) is reused verbatim
 * as the new Lesson.id. This means every key in a user's existing
 * completedLessons/bookmarks/notes/etc. dictionaries still resolves correctly
 * after migration — no remapping table needed, no risk of silently orphaning
 * progress. These strings are now frozen: the *positional* scheme is retired
 * going forward (new content uses generateId()), but these specific legacy
 * strings are simply the permanent ids of those specific lessons now.
 *
 * Course/Section ids are likewise deterministic (not random), so re-running
 * this migration against the same legacy data always produces the same ids —
 * required for it to be safe to run on every load until Phase 1 fully retires
 * the legacy arrays.
 */
import { PL300_SECTIONS, PMIPBA_SECTIONS } from '../data';
import { CourseSection as LegacyCourseSection, StudyPlanState } from '../services/Sync/types';
import {
  Course, Section, Lesson, LessonType, UserProgress, LessonStatus, LessonPriority,
} from './types';

export const LEGACY_COURSE_IDS = {
  PL300: 'course-pl300',
  PMIPBA: 'course-pmipba',
} as const;

const LEGACY_COURSE_META: { key: 'PL-300' | 'PMI-PBA'; id: string; name: string; color: string; examDate: string; sections: LegacyCourseSection[]; description: string; category: string }[] = [
  {
    key: 'PL-300', id: LEGACY_COURSE_IDS.PL300, name: 'PL-300: Microsoft Power BI Data Analyst', color: '#D4AF37', examDate: '2026-08-25', sections: PL300_SECTIONS,
    description: 'Core syllabus covering BI modeling, data cleaning, DAX expression writing, dashboard layout rules, and dynamic workspace governance.',
    category: 'Professional Certification',
  },
  {
    key: 'PMI-PBA', id: LEGACY_COURSE_IDS.PMIPBA, name: 'PMI-PBA: Business Analysis', color: '#8B6F1F', examDate: '2026-08-16', sections: PMIPBA_SECTIONS,
    description: 'Comprehensive syllabus focused on project requirements evaluation, traceability matrices, scope validation, and solution architecture design.',
    category: 'Professional Certification',
  },
];

/** Heuristic type inference from legacy title text — legacy data has no explicit type field. */
function inferLessonType(title: string): LessonType {
  const t = title.toLowerCase();
  if (t.startsWith('quiz') || t.includes('quiz')) return 'quiz';
  if (t.includes('practice test') || t.includes('practice exam')) return 'practice';
  if (t.startsWith('questions') || t === 'questions') return 'quiz';
  return 'video'; // legacy content is Udemy video-lecture titles by default
}

export interface MigratedCourse extends Course {
  sections: (Section & { lessons: Lesson[] })[];
}

/** Pure, deterministic. Safe to call on every load. */
export function buildCoursesFromLegacyData(): MigratedCourse[] {
  return LEGACY_COURSE_META.map(meta => {
    const sections = meta.sections.map((legacySection, si): Section & { lessons: Lesson[] } => {
      const sectionId = `${meta.id}-sec${si}`;
      const lessons: Lesson[] = legacySection.items.map((item, li) => {
        const [title, duration] = item;
        return {
          id: `${meta.key === 'PL-300' ? 'pl300' : 'pmipba'}-s${si}-l${li}`, // == legacy id, verbatim
          sectionId,
          title,
          description: '',
          type: inferLessonType(title),
          duration,
          difficulty: 'Medium',
          scheduledDate: null,
          resources: [],
          attachments: [],
          practiceQuestions: [],
        };
      });
      return { id: sectionId, courseId: meta.id, name: legacySection.sec, order: si, lessons };
    });

    return {
      id: meta.id,
      name: meta.name,
      mode: 'manual',
      color: meta.color,
      examDate: meta.examDate,
      createdAt: '2026-01-01',
      description: meta.description,
      category: meta.category,
      sections,
    };
  });
}

/**
 * Converts a legacy StudyPlanState into the generic UserProgress shape.
 * Fields that don't belong to per-lesson progress (salary, streak, studyLog,
 * lessonsLog, interviewAnswers, journal) are NOT part of UserProgress — they
 * remain on the app-level state as-is until Profile/aggregate-stats migration
 * (tracked separately; see ROADMAP.md). This function only handles the
 * per-lesson dictionaries so no existing per-lesson data is lost.
 */
export function legacyStateToUserProgress(legacy: StudyPlanState): UserProgress {
  const lessonStatus: Record<string, LessonStatus> = {};
  Object.entries(legacy.completedLessons || {}).forEach(([id, done]) => {
    if (done) lessonStatus[id] = 'completed';
  });

  const priority: Record<string, LessonPriority> = {};
  Object.entries(legacy.priority || {}).forEach(([id, flagged]) => {
    if (flagged) priority[id] = 'High';
  });

  return {
    lessonStatus,
    bookmarks: { ...(legacy.bookmarks || {}) },
    difficultyRating: { ...(legacy.difficulty || {}) },
    priority,
    revisionDates: { ...(legacy.revisionDates || {}) },
    notes: { ...(legacy.notes || {}) },
    completionDates: { ...(legacy.completionDates || {}) },
    completionTimes: { ...(legacy.completionTimes || {}) },
    richNotes: { ...(legacy.richNotes || {}) },
  };
}

/** Inverse of legacyStateToUserProgress's lessonStatus mapping — for regression verification only. */
export function userProgressToLegacyCompletedLessons(progress: UserProgress): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  Object.entries(progress.lessonStatus).forEach(([id, status]) => {
    if (status === 'completed') out[id] = true;
  });
  return out;
}

/**
 * Full inverse of legacyStateToUserProgress, used by cloud persistence
 * (models/cloudPersistence.ts) to merge cloud-loaded UserProgress back into
 * the legacy StudyPlanState shape every existing component still reads.
 * Fields that aren't part of UserProgress (streak, salary, journal, studyLog,
 * lessonsLog, interviewAnswers) are preserved from `base`, not overwritten —
 * this function only touches the per-lesson dictionaries.
 */
export function userProgressToLegacyState(progress: UserProgress, base: StudyPlanState): StudyPlanState {
  const priority: Record<string, boolean> = {};
  Object.entries(progress.priority).forEach(([id, level]) => {
    if (level === 'High') priority[id] = true;
  });

  return {
    ...base,
    completedLessons: userProgressToLegacyCompletedLessons(progress),
    bookmarks: { ...progress.bookmarks },
    difficulty: { ...progress.difficultyRating },
    priority,
    revisionDates: { ...progress.revisionDates },
    notes: { ...progress.notes },
    completionDates: { ...progress.completionDates },
    completionTimes: { ...progress.completionTimes },
    richNotes: { ...(progress.richNotes || legacyStateToUserProgress(base).richNotes || {}) },
  };
}
