/**
 * Verification script for the legacy → generic migration (not part of the app bundle).
 *
 * Run with: npx tsx scripts/verifyMigration.ts
 *
 * Checks, per ROADMAP.md Phase 1 "regression pass" requirement:
 *   1. Every legacy lesson id in ALL_LESSONS has a corresponding generic Lesson
 *      with the exact same id (no ids dropped, none invented, none renamed).
 *   2. Lesson counts match exactly, per course and in total.
 *   3. A round-trip of completedLessons -> UserProgress -> completedLessons
 *      is lossless for arbitrary sample progress data.
 */
import { ALL_LESSONS } from '../src/data';
import { buildCoursesFromLegacyData, legacyStateToUserProgress, userProgressToLegacyCompletedLessons, LEGACY_COURSE_IDS } from '../src/models/migrateLegacy';
import { StudyPlanState } from '../src/services/Sync/types';

let failures = 0;
function check(label: string, pass: boolean) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label}`);
  if (!pass) failures++;
}

// --- 1 & 2: id and count parity ---
const migrated = buildCoursesFromLegacyData();
const migratedLessonIds = new Set<string>();
let migratedTotal = 0;
migrated.forEach(course => course.sections.forEach(section => section.lessons.forEach(lesson => {
  migratedLessonIds.add(lesson.id);
  migratedTotal++;
})));

check(`total lesson count matches ALL_LESSONS (${ALL_LESSONS.length})`, migratedTotal === ALL_LESSONS.length);

const missing = ALL_LESSONS.filter(l => !migratedLessonIds.has(l.id));
check(`every legacy id present in migrated model (0 missing)`, missing.length === 0);
if (missing.length) console.log('  missing ids:', missing.slice(0, 10).map(l => l.id));

const extra = [...migratedLessonIds].filter(id => !ALL_LESSONS.some(l => l.id === id));
check(`no invented ids beyond legacy set (0 extra)`, extra.length === 0);
if (extra.length) console.log('  extra ids:', extra.slice(0, 10));

['PL-300', 'PMI-PBA'].forEach(courseKey => {
  const legacyCount = ALL_LESSONS.filter(l => l.course === courseKey).length;
  const courseId = courseKey === 'PL-300' ? LEGACY_COURSE_IDS.PL300 : LEGACY_COURSE_IDS.PMIPBA;
  const migratedCourse = migrated.find(c => c.id === courseId);
  const migratedCount = migratedCourse ? migratedCourse.sections.reduce((a, s) => a + s.lessons.length, 0) : -1;
  check(`${courseKey}: legacy count (${legacyCount}) == migrated count (${migratedCount})`, legacyCount === migratedCount);
});

// --- 3: progress round-trip ---
const sampleIds = ALL_LESSONS.slice(0, 25).map(l => l.id);
const sampleCompleted: Record<string, boolean> = {};
sampleIds.forEach((id, i) => { if (i % 2 === 0) sampleCompleted[id] = true; });

const fakeLegacyState = {
  completedLessons: sampleCompleted,
  bookmarks: {}, difficulty: {}, priority: {}, revisionDates: {},
  salary: { current: '', mid: '', target: '' },
  streak: 0, bestStreak: 0, lastStudyDate: null,
  studyLog: {}, lessonsLog: {}, interviewAnswers: {}, journal: [], notes: {},
} as unknown as StudyPlanState;

const progress = legacyStateToUserProgress(fakeLegacyState);
const roundTripped = userProgressToLegacyCompletedLessons(progress);

const roundTripOk = Object.keys(sampleCompleted).every(id => roundTripped[id] === true)
  && Object.keys(roundTripped).length === Object.keys(sampleCompleted).length;
check('completedLessons round-trips losslessly through UserProgress', roundTripOk);

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
