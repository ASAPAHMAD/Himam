/**
 * Course display helpers — metadata-driven presentation layer.
 *
 * Pure, deterministic, no React dependency, no side effects — same pattern
 * as services/progressEngine.ts and models/schedulingEngine.ts.
 *
 * Exists so that any component (currently StudyCenter.tsx) can answer
 * "what course is this lesson from, what should it be called, and what
 * color is it?" purely from Course Catalog data, with zero branching on a
 * specific course id or name. Adding a course to the catalog is enough to
 * have it appear correctly everywhere these helpers are used — no component
 * changes required.
 */
import { Course, CourseWithContent } from './types';

/**
 * Short display label for a course, derived from its name rather than a
 * hardcoded id check. Convention: content before the first colon is the
 * short code ("PL-300: Microsoft Power BI Data Analyst" -> "PL-300").
 * Falls back to the full name for courses with no colon in their title.
 *
 * Verified to reproduce the exact same output as the old
 * `course.id === 'course-pl300' ? 'PL-300' : ...` ternary for both existing
 * legacy courses — this is a like-for-like replacement, not a behavior change.
 */
export function getCourseShortLabel(course: Course): string {
  return course.name.split(':')[0].trim();
}

export interface CourseStats {
  sectionCount: number;
  lessonCount: number;
}

/** Real section/lesson counts computed from actual catalog content. */
export function getCourseStats(course: CourseWithContent): CourseStats {
  return {
    sectionCount: course.sections.length,
    lessonCount: course.sections.reduce((sum, s) => sum + s.lessons.length, 0),
  };
}

export interface CourseAccent {
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  cardBorder: string;
  cardShadow: string;
}

/**
 * Small ordered palette. Courses are themed by their position in the Course
 * Catalog, not by name/id — slots 0 and 1 use the exact hex values the app
 * already used for PL-300 and PMI-PBA, so today's two courses render
 * pixel-identical to before. A 3rd/4th catalog course gets a distinct,
 * already-designed accent automatically instead of falling back to a
 * default gray or requiring a new hardcoded branch.
 *
 * (Course.color already exists on the data model for future finer-grained
 * per-course theming — not wired to rendering yet; out of scope for this
 * change, flagged as follow-up.)
 */
const ACCENT_PALETTE: CourseAccent[] = [
  { badgeBg: '#171B24', badgeBorder: 'rgba(197,160,89,0.3)', badgeText: '#D4AF37', cardBorder: 'rgba(197,160,89,0.3)', cardShadow: 'rgba(197,160,89,0.05)' },
  { badgeBg: '#0D1821', badgeBorder: 'rgba(59,130,246,0.3)', badgeText: '#60A5FA', cardBorder: 'rgba(59,130,246,0.3)', cardShadow: 'rgba(59,130,246,0.05)' },
  { badgeBg: '#160D21', badgeBorder: 'rgba(139,92,246,0.3)', badgeText: '#A78BFA', cardBorder: 'rgba(139,92,246,0.3)', cardShadow: 'rgba(139,92,246,0.05)' },
  { badgeBg: '#0D2117', badgeBorder: 'rgba(16,185,129,0.3)', badgeText: '#34D399', cardBorder: 'rgba(16,185,129,0.3)', cardShadow: 'rgba(16,185,129,0.05)' },
];

export function getCourseAccent(indexInCatalog: number): CourseAccent {
  return ACCENT_PALETTE[indexInCatalog % ACCENT_PALETTE.length];
}

export interface LessonCourseMeta {
  course: CourseWithContent;
  shortLabel: string;
  accent: CourseAccent;
}

/**
 * The core missing piece: lessonId -> { course, shortLabel, accent }.
 * Built once from a catalog snapshot (cheap at current content scale — see
 * performance notes in the handoff), not recomputed per lesson or per card.
 * Replaces every `lesson.course === 'PL-300'` / `course.id === 'course-pl300'`
 * check that used to exist per-component.
 */
export function buildLessonCourseIndex(courses: CourseWithContent[]): Map<string, LessonCourseMeta> {
  const index = new Map<string, LessonCourseMeta>();
  courses.forEach((course, i) => {
    const meta: LessonCourseMeta = {
      course,
      shortLabel: getCourseShortLabel(course),
      accent: getCourseAccent(i),
    };
    course.sections.forEach(section => {
      section.lessons.forEach(lesson => {
        index.set(lesson.id, meta);
      });
    });
  });
  return index;
}

/**
 * Resolves a single lesson id to its full Lesson object plus its course
 * metadata, searching across the given catalog courses. Built on top of
 * buildLessonCourseIndex so lesson->course attribution has exactly one
 * implementation, reused by both StudyCenter's rendering and the AI Coach's
 * context builder.
 */
export function getLessonWithCourse(
  courses: CourseWithContent[],
  lessonId: string
): { lesson: CourseWithContent['sections'][number]['lessons'][number]; meta: LessonCourseMeta } | undefined {
  const index = buildLessonCourseIndex(courses);
  const meta = index.get(lessonId);
  if (!meta) return undefined;
  for (const section of meta.course.sections) {
    const lesson = section.lessons.find(l => l.id === lessonId);
    if (lesson) return { lesson, meta };
  }
  return undefined;
}
