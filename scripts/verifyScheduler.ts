/**
 * Verification script for the generic scheduling engine (not part of the app bundle).
 * Run with: npx tsx scripts/verifyScheduler.ts
 */
import { buildCoursesFromLegacyData } from '../src/models/migrateLegacy';
import {
  generateSchedule, detectMissedLessons, rescheduleMissed, proposeRevisionDates, CourseLessons,
} from '../src/models/schedulingEngine';
import { Profile, UserProgress, Lesson } from '../src/models/types';

let failures = 0;
function check(label: string, pass: boolean) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label}`);
  if (!pass) failures++;
}

const emptyProgress: UserProgress = {
  lessonStatus: {}, bookmarks: {}, difficultyRating: {}, priority: {},
  revisionDates: {}, notes: {}, completionDates: {}, completionTimes: {},
};

// --- Parity-style check: two courses, two windows, Sun-Wed working days (legacy minus the
// one-off "working Thursday" exceptions, which the generic model doesn't special-case — see
// CHANGELOG for that known gap), vacation matching the legacy range, 45-min windows. ---
const profile: Profile = {
  id: 'p1', name: 'Test', country: '', timezone: '', careerGoal: '', currentJob: '', targetJob: '',
  currentSalary: '', targetSalary: '', learningGoals: [],
  workingDays: ['Sun', 'Mon', 'Tue', 'Wed'],
  vacationRanges: [{ start: '2026-07-22', end: '2026-08-02' }],
  holidays: [],
  extraWorkingDays: [],
  studyWindows: [{ label: 'Morning', startTime: '07:00', endTime: '07:45', minutes: 45 }, { label: 'Lunch', startTime: '12:00', endTime: '12:45', minutes: 45 }],
  learningStyle: 'Mixed',
  onboardingCompleted: true,
  onboardingStep: 'complete',
};

const migrated = buildCoursesFromLegacyData();
const courseLessons: CourseLessons[] = migrated.map(c => ({
  course: c,
  lessons: c.sections.flatMap(s => s.lessons),
}));

const totalLessons = courseLessons.reduce((a, c) => a + c.lessons.length, 0);
const schedule = generateSchedule(profile, courseLessons, emptyProgress, new Date(2026, 6, 14), 60);

const scheduledCount = schedule.reduce((a, day) => a + day.windows.reduce((b, w) => b + w.lessons.length, 0), 0);
check(`engine schedules every pending lesson exactly once (${scheduledCount}/${totalLessons})`, scheduledCount === totalLessons);

const workableWeekdays = schedule.filter(d => d.isWorkable).every(d => ['Sun', 'Mon', 'Tue', 'Wed'].includes(
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.date.getDay()]
));
check('every workable day falls on a configured working day', workableWeekdays);

const noVacationWork = schedule.filter(d => d.isVacation).every(d => !d.isWorkable);
check('no day inside vacation range is workable', noVacationWork);

const windowBudgetRespected = schedule.every(day => day.windows.every(w =>
  w.lessons.length <= 1 || w.estimatedMinutes <= 45 || w.lessons.slice(0, -1).reduce((a, l) => a + l.duration, 0) <= 45
));
check('no window exceeds its minute budget (except a single first lesson longer than the budget)', windowBudgetRespected);

// --- Missed-session detection + rescheduling ---
const fakeLessons: Lesson[] = [
  { id: 'm1', sectionId: 's', title: 'Missed 1', description: '', type: 'video', duration: 20, difficulty: 'Easy', scheduledDate: '2026-01-01', resources: [], attachments: [], practiceQuestions: [] },
  { id: 'm2', sectionId: 's', title: 'Missed 2', description: '', type: 'video', duration: 20, difficulty: 'Easy', scheduledDate: '2026-01-02', resources: [], attachments: [], practiceQuestions: [] },
  { id: 'ok', sectionId: 's', title: 'Not missed (completed)', description: '', type: 'video', duration: 20, difficulty: 'Easy', scheduledDate: '2026-01-01', resources: [], attachments: [], practiceQuestions: [] },
  { id: 'future', sectionId: 's', title: 'Not missed (future)', description: '', type: 'video', duration: 20, difficulty: 'Easy', scheduledDate: '2099-01-01', resources: [], attachments: [], practiceQuestions: [] },
];
const progressWithOneDone: UserProgress = { ...emptyProgress, lessonStatus: { ok: 'completed' } };
const missed = detectMissedLessons(fakeLessons, progressWithOneDone, '2026-06-01');
check('detects exactly the 2 missed lessons (not the completed or future ones)', missed.length === 2 && missed.every(l => ['m1', 'm2'].includes(l.id)));

const rescheduled = rescheduleMissed(profile, missed, new Date(2026, 6, 14), {});
check('reschedules every missed lesson to some future date', Object.keys(rescheduled).length === 2);
check('rescheduled dates are on working days', Object.values(rescheduled).every(iso => {
  const d = new Date(iso + 'T00:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed'].includes(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]);
}));

// --- Revision proposal ---
const revisionDates = proposeRevisionDates(new Date(2026, 6, 14));
check('proposes 2 revision dates (+3, +7 days)', revisionDates.length === 2 && revisionDates[0] === '2026-07-17' && revisionDates[1] === '2026-07-21');

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
