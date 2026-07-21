/**
 * Generic scheduling engine — Phase 1 architecture refactor.
 *
 * Replaces the fixed-2026, fixed-two-course logic in `src/utils/scheduler.ts`
 * (kept untouched for now so existing components keep working — see
 * ROADMAP.md for the cutover step). This module knows nothing about any
 * specific certification, employer, or calendar year: everything that varies
 * is passed in via `Profile` and the course/lesson list.
 *
 * Covers, per ARCHITECTURE.md §4 / PRODUCT_SPEC.md "Scheduling Engine":
 *   - working days, weekends, holidays, vacation ranges
 *   - multiple study sessions ("windows") per day, each with its own minute budget
 *   - missed-session detection and automatic forward-rescheduling
 *   - engine-proposed revision sessions after a lesson is completed
 */
import { Course, Lesson, Profile, StudyWindow, UserProgress } from './types';

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface CourseLessons {
  course: Course;
  lessons: Lesson[]; // in the order they should be studied (section/lesson order)
}

export interface ScheduledWindow {
  label: string;
  lessons: Lesson[];
  estimatedMinutes: number;
}

export interface ScheduledDay {
  dateStr: string; // YYYY-MM-DD
  date: Date;
  isWorkable: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  isVacation: boolean;
  examCourseIds: string[]; // courses whose examDate falls on this day
  windows: ScheduledWindow[];
  estimatedDailyMinutes: number;
}

export interface ScheduledWeek {
  weekLabel: string;
  days: ScheduledDay[];
}
// ^ concrete alias for the generic groupScheduleByWeek<ScheduledDay>() return shape.

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isInRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

function getWeekIndex(date: Date): number {
  const temp = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const day = temp.getDay();
  const sunday = new Date(temp.getTime() - day * 24 * 60 * 60 * 1000);
  const refSunday = new Date('2026-01-04T12:00:00');
  const diffMs = sunday.getTime() - refSunday.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function isWorkingDay(profile: Profile, date: Date, iso: string): boolean {
  const name = WEEKDAY_NAMES[date.getDay()];
  if (profile.extraWorkingDays && profile.extraWorkingDays.includes(iso)) return true;
  
  if (profile.biWeeklyEnabled) {
    const weekIdx = getWeekIndex(date);
    const isWeekB = (weekIdx % 2 !== 0);
    const activeWorkingDays = isWeekB 
      ? (profile.workingDaysWeekB || []) 
      : (profile.workingDays || []);
    return activeWorkingDays.includes(name);
  }
  
  return profile.workingDays.includes(name);
}

function isVacationDay(profile: Profile, iso: string): boolean {
  return profile.vacationRanges.some(r => isInRange(iso, r.start, r.end));
}

function isHolidayDay(profile: Profile, iso: string): boolean {
  return profile.holidays.includes(iso);
}

/**
 * Generates a day-by-day schedule starting at `startDate` for `rangeDays` days,
 * pulling from each course's pending lesson queue (in order) and filling each
 * of the profile's study windows up to its minute budget — generalizing the
 * legacy "PL-300 fills morning, PMI-PBA fills lunch" rule to: N courses fill
 * N-or-fewer windows, in course order, first-lesson-always-fits-then-budget-checked
 * (same allocation rule the legacy code used, just not hardcoded to 45 minutes
 * or to exactly two named courses).
 *
 * A lesson is "pending" if it has no UserProgress status of 'completed' yet.
 * Already-completed lessons are skipped when building each course's queue.
 */
export function generateSchedule(
  profile: Profile,
  courseLessons: CourseLessons[],
  progress: UserProgress,
  startDate: Date,
  rangeDays: number,
): ScheduledDay[] {
  const queues = courseLessons.map(cl => ({
    course: cl.course,
    pending: cl.lessons.filter(l => progress.lessonStatus[l.id] !== 'completed'),
    idx: 0,
  }));

  const examDatesByDay = new Map<string, string[]>();
  courseLessons.forEach(cl => {
    if (cl.course.examDate) {
      const arr = examDatesByDay.get(cl.course.examDate) || [];
      arr.push(cl.course.id);
      examDatesByDay.set(cl.course.examDate, arr);
    }
  });

  const schedule: ScheduledDay[] = [];
  const current = new Date(startDate);

  // Keep generating until we've covered rangeDays AND drained every queue,
  // same "don't stop until content runs out" behavior as the legacy engine.
  let day = 0;
  while (day < rangeDays || queues.some(q => q.idx < q.pending.length)) {
    const iso = toISO(current);
    const vacation = isVacationDay(profile, iso);
    const holiday = isHolidayDay(profile, iso);
    const weekend = !isWorkingDay(profile, current, iso);
    const workable = !vacation && !holiday && !weekend;

    const windows: ScheduledWindow[] = profile.studyWindows.map(w => ({ label: w.label, lessons: [], estimatedMinutes: 0 }));

    if (workable) {
      profile.studyWindows.forEach((studyWindow: StudyWindow, wi) => {
        const queue = queues[wi % Math.max(queues.length, 1)]; // course-per-window, cycling if fewer courses than windows
        if (!queue) return;
        const win = windows[wi];
        while (queue.idx < queue.pending.length) {
          const lesson = queue.pending[queue.idx];
          if (win.estimatedMinutes === 0 || win.estimatedMinutes + lesson.duration <= studyWindow.minutes) {
            win.lessons.push(lesson);
            win.estimatedMinutes += lesson.duration;
            queue.idx++;
          } else {
            break;
          }
        }
      });
    }

    schedule.push({
      dateStr: iso,
      date: new Date(current),
      isWorkable: workable,
      isWeekend: weekend,
      isHoliday: holiday,
      isVacation: vacation,
      examCourseIds: examDatesByDay.get(iso) || [],
      windows,
      estimatedDailyMinutes: windows.reduce((a, w) => a + w.estimatedMinutes, 0),
    });

    current.setDate(current.getDate() + 1);
    day++;

    // Safety valve: never loop forever if content can't be drained (e.g. no workable days at all).
    if (day > rangeDays + 3650) break;
  }

  return schedule;
}

/**
 * Generic over any day-shape with a `date` field — used both by the new
 * engine's own ScheduledDay and by src/models/legacyScheduleAdapter.ts's
 * legacy-shaped days, so the week-grouping logic (which never actually
 * touched course-specific fields) exists exactly once.
 */
export function groupScheduleByWeek<T extends { date: Date }>(schedule: T[]): { weekLabel: string; days: T[] }[] {
  const weeksMap = new Map<string, T[]>();

  schedule.forEach(day => {
    const d = new Date(day.date);
    const dow = d.getDay();
    const diff = d.getDate() - dow + (dow === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startMonth = monday.toLocaleDateString('en-US', { month: 'short' });
    const startDay = monday.getDate();
    const endMonth = sunday.toLocaleDateString('en-US', { month: 'short' });
    const endDay = sunday.getDate();
    const label = `Week ${startMonth} ${startDay} – ${endMonth === startMonth ? '' : endMonth + ' '}${endDay}`;

    if (!weeksMap.has(label)) weeksMap.set(label, []);
    weeksMap.get(label)!.push(day);
  });

  const result: { weekLabel: string; days: T[] }[] = [];
  weeksMap.forEach((days, weekLabel) => {
    days.sort((a, b) => a.date.getTime() - b.date.getTime());
    result.push({ weekLabel, days });
  });
  return result;
}

/**
 * Missed-session detection: a lesson with an explicit scheduledDate in the
 * past that isn't marked completed. Applies to lessons that have already
 * been assigned a fixed date (AI-generated plans, or a manually-dragged
 * lesson) — not to lessons still sitting unscheduled in a course queue.
 */
export function detectMissedLessons(lessons: Lesson[], progress: UserProgress, todayISO: string): Lesson[] {
  return lessons.filter(l =>
    l.scheduledDate !== null &&
    l.scheduledDate < todayISO &&
    progress.lessonStatus[l.id] !== 'completed' &&
    progress.lessonStatus[l.id] !== 'skipped'
  );
}

/**
 * Automatic rescheduling: moves each missed lesson's scheduledDate forward to
 * the next workable day, respecting the same per-window minute budgets as
 * generateSchedule — filling each candidate day's windows in order, moving to
 * the next day once all windows for a day are full or unworkable.
 * Returns a map of lessonId -> new scheduledDate (callers apply the update;
 * this function does not mutate).
 */
export function rescheduleMissed(
  profile: Profile,
  missed: Lesson[],
  fromDate: Date,
  occupiedMinutesByDateWindow: Record<string, number[]>, // dateStr -> minutes already used per window index
): Record<string, string> {
  const result: Record<string, string> = {};
  const occupied = JSON.parse(JSON.stringify(occupiedMinutesByDateWindow)) as Record<string, number[]>;
  const current = new Date(fromDate);
  let queueIdx = 0;
  let daysChecked = 0;

  while (queueIdx < missed.length && daysChecked < 3650) {
    const iso = toISO(current);
    const workable = !isVacationDay(profile, iso) && !isHolidayDay(profile, iso) && isWorkingDay(profile, current, iso);

    if (workable) {
      if (!occupied[iso]) occupied[iso] = profile.studyWindows.map(() => 0);
      for (let wi = 0; wi < profile.studyWindows.length && queueIdx < missed.length; wi++) {
        const budget = profile.studyWindows[wi].minutes;
        const lesson = missed[queueIdx];
        const used = occupied[iso][wi] || 0;
        if (used === 0 || used + lesson.duration <= budget) {
          result[lesson.id] = iso;
          occupied[iso][wi] = used + lesson.duration;
          queueIdx++;
        }
      }
    }

    current.setDate(current.getDate() + 1);
    daysChecked++;
  }

  return result;
}

/**
 * Proposes a revision session for a lesson just marked complete: a lightweight
 * spaced-repetition suggestion at +3 and +7 days. Returns candidate dates only
 * — the caller decides whether to create an actual `type: 'revision'` Lesson
 * entry (or just set UserProgress.revisionDates), per PRODUCT_SPEC.md ("the
 * user can accept or move it").
 */
export function proposeRevisionDates(completedOn: Date, intervals: number[] = [3, 7]): string[] {
  return intervals.map(days => {
    const d = new Date(completedOn);
    d.setDate(d.getDate() + days);
    return toISO(d);
  });
}
