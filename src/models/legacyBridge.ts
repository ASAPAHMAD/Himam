/**
 * TRANSITIONAL LEGACY BRIDGE — Phase 1 only.
 *
 * Why this file exists: ARCHITECTURE.md's target is that components read
 * generic Course/Section/Lesson entities and per-user UserProgress. Getting
 * there fully means App.tsx's root state also has to move off the legacy
 * `StudyPlanState` (completedLessons/bookmarks/etc. keyed directly on state)
 * — that is a separate, larger, riskier change than migrating one read-mostly
 * component at a time.
 *
 * So Phase 1 migrates components in two independent steps:
 *   1. (this file) Stop importing `ALL_LESSONS` / comparing `l.course === 'PL-300'`
 *      directly in components — read the generic `Course`/`Lesson` shape instead,
 *      via `buildCoursesFromLegacyData()`.
 *   2. (a later, separate change) Move App.tsx's root state itself onto
 *      `UserProgress` + `Profile`.
 *
 * Until step 2 happens, this module bridges the two: it exposes the generic
 * course data, plus small helpers that read progress out of the *legacy*
 * `StudyPlanState` shape (since that's still what App.tsx actually persists).
 * Nothing here is new product logic — it's the same computations every
 * component was already doing, written once instead of duplicated per file.
 *
 * When App.tsx's state migrates to UserProgress, these helpers' internals
 * change to read `UserProgress` instead of `StudyPlanState`; their signatures
 * and the generic `Course`/`Lesson` data they expose do not need to change,
 * so components built against this bridge won't need a second migration.
 */
import { StudyPlanState } from '../services/Sync/types';
import { buildCoursesFromLegacyData, MigratedCourse, LEGACY_COURSE_IDS } from './migrateLegacy';
import { Lesson } from './types';

// Legacy data.ts is a static module-level array — building it is pure and
// cheap, but there's no reason to redo it on every call site.
export const LEGACY_COURSES: MigratedCourse[] = buildCoursesFromLegacyData();

export { LEGACY_COURSE_IDS };

export function getLegacyCourseById(id: string): MigratedCourse | undefined {
  return LEGACY_COURSES.find(c => c.id === id);
}

export interface CourseProgressStat {
  id: string;
  name: string;
  color: string;
  totalLessons: number;
  doneLessons: number;
  totalMinutes: number;
  doneMinutes: number;
}

/** Generic — works for any course with any number of lessons, not just the two legacy ones. */
export function computeCourseProgress(state: StudyPlanState, course: MigratedCourse): CourseProgressStat {
  const lessons = course.sections.flatMap(s => s.lessons);
  const done = lessons.filter(l => state.completedLessons[l.id]);
  return {
    id: course.id,
    name: course.name,
    color: course.color,
    totalLessons: lessons.length,
    doneLessons: done.length,
    totalMinutes: lessons.reduce((a, l) => a + l.duration, 0),
    doneMinutes: done.reduce((a, l) => a + l.duration, 0),
  };
}

/** All lessons across all migrated legacy courses — the generic-model equivalent of ALL_LESSONS. */
export function allLegacyLessons(): Lesson[] {
  return LEGACY_COURSES.flatMap(c => c.sections.flatMap(s => s.lessons));
}

/**
 * Finds lessons belonging to a section by (partial) name match, replacing the
 * legacy scheme's reliance on a numeric `sectionIndex` field the generic
 * Lesson type doesn't have. Section names are stable content, not an index,
 * so this survives reordering — unlike the field it replaces.
 */
export function lessonsInSectionNamed(course: MigratedCourse, nameIncludes: string): Lesson[] {
  const section = course.sections.find(s => s.name.includes(nameIncludes));
  return section ? section.lessons : [];
}
