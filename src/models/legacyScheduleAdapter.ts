/**
 * Legacy-shaped schedule adapter — Phase 1 engine cutover.
 *
 * Produces the EXACT same `ScheduledDay`/`ScheduledWeek` shape that
 * `utils/scheduler.ts` did (see that file's interface before deletion),
 * but computed internally by the new generic `schedulingEngine.ts` instead
 * of hardcoded 2026/two-course logic. This means `StudyCenter.tsx` and
 * `Calendar.tsx` — both very large files whose JSX is written directly
 * against that shape (`day.morningSession`, `day.lunchSession`,
 * `day.isOffThursday`, etc.) — only need their *import* changed, not a
 * rewrite of hundreds of lines of rendering code.
 *
 * How parity with the old scheduler.ts is achieved, parameter by parameter:
 *   - workingDays = ['Sun','Mon','Tue','Wed'] (Thursday excluded) +
 *     extraWorkingDays = the 4 specific working-Thursday dates
 *     -> reproduces `workingThursdays` exactly (see models/defaultProfile.ts).
 *   - vacationRanges = July 22 – Aug 2 -> reproduces `leaveStart`/`leaveEnd`.
 *   - studyWindows = 45/45 minutes -> reproduces the hardcoded `<= 45` budget
 *     check in both sessions.
 *   - Course.examDate (PL-300 Aug 25, PMI-PBA Aug 16, set in migrateLegacy.ts)
 *     -> reproduces the `isPMIMilestone`/`isPLMilestone` literal date checks.
 *   - Lessons before July 14 are never scheduled because the engine's
 *     generation start date IS July 14 — matching the old `isAfterStart`
 *     cutoff. July 1–13 are separately padded in as non-workable calendar
 *     filler (see `PADDING_START`/`GENERATION_START` below), matching the
 *     old code's `startDate = July 1` display range.
 *
 * Correctness of all of this is verified independently in
 * scripts/verifyScheduleAdapter.ts, which diffs this adapter's output
 * against the old utils/scheduler.ts's output field-by-field, for every
 * generated day, under several different progress states.
 */
import { StudyPlanState, Lesson as LegacyLesson } from '../services/Sync/types';
import { ALL_LESSONS } from '../data';
import { LEGACY_COURSES, LEGACY_COURSE_IDS } from './legacyBridge';
import { generateSchedule, groupScheduleByWeek as genericGroupByWeek, CourseLessons } from './schedulingEngine';
import { Profile, UserProgress } from './types';
import { CourseCatalog } from '../services/courseCatalog';

export interface ScheduledDay {
  dateStr: string;
  date: Date;
  isWorkable: boolean;
  isWeekend: boolean;
  isLeave: boolean;
  isOffThursday: boolean;
  isPMIMilestone: boolean;
  isPLMilestone: boolean;
  plLessons: LegacyLesson[];
  pbiLessons: LegacyLesson[];
  morningSession: LegacyLesson[];
  lunchSession: LegacyLesson[];
  estimatedMorningTime: number;
  estimatedLunchTime: number;
  estimatedDailyTime: number;
  manualTasks?: Array<{ id: string; title: string; duration: number; completed: boolean }>;
}

export interface ScheduledWeek {
  weekLabel: string;
  days: ScheduledDay[];
}

const PADDING_START = new Date(2026, 6, 1);   // July 1, 2026 — matches old startDate (display-only padding)
const GENERATION_START = new Date(2026, 6, 14); // July 14, 2026 — matches old isAfterStart cutoff
const GENERATION_END = new Date(2026, 7, 31);   // August 31, 2026 — matches old endDate
const RANGE_DAYS = Math.round((GENERATION_END.getTime() - GENERATION_START.getTime()) / 86400000) + 1;

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// O(1) legacy-shaped lesson lookup by id — content is identical between
// ALL_LESSONS and the generic model (verified in scripts/verifyMigration.ts),
// so this is a pure re-shaping step, not a second source of truth.
const legacyLessonById = new Map<string, LegacyLesson>(ALL_LESSONS.map(l => [l.id, l]));

export function getFullScheduleFromEngine(profile: Profile, legacyState: StudyPlanState): ScheduledDay[] {
  // Deliberately NOT `legacyStateToUserProgress(legacyState)` here.
  //
  // The legacy scheduler lays the ENTIRE syllabus onto the calendar in a
  // fixed order, regardless of completion — `state.completedLessons` is
  // read only by the UI (checkboxes), never by `getFullSchedule` itself, so
  // a lesson keeps its calendar slot whether or not it's been checked off.
  // The new engine's `generateSchedule()` deliberately does the opposite by
  // design (skip completed lessons, so remaining ones shift forward) — that
  // richer behavior is real, wanted, future functionality (see
  // schedulingEngine.ts's docstring), but activating it now would silently
  // change which day every remaining lesson appears on for a real user, which
  // is exactly the kind of regression this parity script exists to catch.
  // Scheduling against an empty progress object reproduces the legacy
  // "static full-syllabus calendar" placement exactly; verified in
  // scripts/verifyScheduleAdapter.ts.
  const emptyProgress: UserProgress = {
    lessonStatus: {}, bookmarks: {}, difficultyRating: {}, priority: {},
    revisionDates: {}, notes: {}, completionDates: {}, completionTimes: {},
  };

  const isManualMode = profile.scheduleMode === 'manual';
  const activeCourses = CourseCatalog.getActiveCourses(profile.learningGoals, profile.learningGoalDetails);

  const courseLessons: CourseLessons[] = activeCourses.map(c => ({
    course: c,
    lessons: c.sections.flatMap(s => s.lessons),
  }));

  const genericDays = generateSchedule(profile, courseLessons, emptyProgress, GENERATION_START, RANGE_DAYS);

  const plCourse = LEGACY_COURSES.find(c => c.id === LEGACY_COURSE_IDS.PL300)!;
  const pbiCourse = LEGACY_COURSES.find(c => c.id === LEGACY_COURSE_IDS.PMIPBA)!;

  const days: ScheduledDay[] = [];

  // Padding: July 1–13, non-workable calendar filler, matching the old
  // scheduler's display range before its `isAfterStart` cutoff.
  const pad = new Date(PADDING_START);
  while (pad < GENERATION_START) {
    const iso = toISO(pad);
    const dow = pad.getDay();
    const mTasks = profile.manualTasks?.[iso] || [];
    const manualTasksDuration = mTasks.reduce((sum, t) => sum + t.duration, 0);

    const morningSession: LegacyLesson[] = [];
    const lunchSession: LegacyLesson[] = [];
    const pinnedIds = profile.manualLessons?.[iso] || [];
    pinnedIds.forEach(id => {
      const lesson = legacyLessonById.get(id);
      if (lesson) {
        if (lesson.course === 'PL-300') {
          morningSession.push(lesson);
        } else {
          lunchSession.push(lesson);
        }
      }
    });

    const estMorning = morningSession.reduce((sum, l) => sum + l.duration, 0);
    const estLunch = lunchSession.reduce((sum, l) => sum + l.duration, 0);

    days.push({
      dateStr: iso,
      date: new Date(pad),
      isWorkable: false,
      isWeekend: dow === 5 || dow === 6,
      isLeave: false, // vacation range (Jul 22–Aug 2) never overlaps the padding window
      isOffThursday: dow === 4 && !profile.extraWorkingDays.includes(iso),
      isPMIMilestone: false,
      isPLMilestone: false,
      plLessons: morningSession,
      pbiLessons: lunchSession,
      morningSession,
      lunchSession,
      estimatedMorningTime: estMorning,
      estimatedLunchTime: estLunch,
      estimatedDailyTime: estMorning + estLunch + manualTasksDuration,
      manualTasks: mTasks,
    });
    pad.setDate(pad.getDate() + 1);
  }

  for (const day of genericDays) {
    const dow = day.date.getDay();
    const mTasks = profile.manualTasks?.[day.dateStr] || [];
    const manualTasksDuration = mTasks.reduce((sum, t) => sum + t.duration, 0);

    let morningSession: LegacyLesson[] = [];
    let lunchSession: LegacyLesson[] = [];

    if (isManualMode) {
      // Manual Mode: only use manually pinned lessons
      const pinnedIds = profile.manualLessons?.[day.dateStr] || [];
      pinnedIds.forEach(id => {
        const lesson = legacyLessonById.get(id);
        if (lesson) {
          if (lesson.course === 'PL-300') {
            morningSession.push(lesson);
          } else {
            lunchSession.push(lesson);
          }
        }
      });
    } else {
      // Automated Mode: use scheduling engine lessons
      const morningWindow = day.windows[0];
      const lunchWindow = day.windows[1];
      morningSession = (morningWindow?.lessons || []).map(l => legacyLessonById.get(l.id)!).filter(Boolean);
      lunchSession = (lunchWindow?.lessons || []).map(l => legacyLessonById.get(l.id)!).filter(Boolean);

      // Also append manually pinned lessons if they aren't already scheduled
      const pinnedIds = profile.manualLessons?.[day.dateStr] || [];
      pinnedIds.forEach(id => {
        const lesson = legacyLessonById.get(id);
        if (lesson && !morningSession.some(l => l.id === id) && !lunchSession.some(l => l.id === id)) {
          if (lesson.course === 'PL-300') {
            morningSession.push(lesson);
          } else {
            lunchSession.push(lesson);
          }
        }
      });
    }

    const estMorning = morningSession.reduce((sum, l) => sum + l.duration, 0);
    const estLunch = lunchSession.reduce((sum, l) => sum + l.duration, 0);

    days.push({
      dateStr: day.dateStr,
      date: day.date,
      isWorkable: day.isWorkable,
      isWeekend: dow === 5 || dow === 6,
      isLeave: day.isVacation,
      isOffThursday: dow === 4 && !profile.extraWorkingDays.includes(day.dateStr),
      isPMIMilestone: day.examCourseIds.includes(pbiCourse.id),
      isPLMilestone: day.examCourseIds.includes(plCourse.id),
      plLessons: morningSession,
      pbiLessons: lunchSession,
      morningSession,
      lunchSession,
      estimatedMorningTime: estMorning,
      estimatedLunchTime: estLunch,
      estimatedDailyTime: estMorning + estLunch + manualTasksDuration,
      manualTasks: mTasks,
    });
  }

  return days;
}

export const groupScheduleByWeek = genericGroupByWeek<ScheduledDay>;
