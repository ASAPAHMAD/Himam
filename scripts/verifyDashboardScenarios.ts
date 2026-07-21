/**
 * Verification for the Dashboard Experience Refinement milestone.
 * Exercises the exact same service calls Dashboard.tsx makes (CourseCatalog,
 * calculateProgressMetrics, buildAIContext) for the 4 required scenarios,
 * confirming each produces sane output with zero exceptions. This is a
 * data-correctness check, not a visual one — no browser available in this
 * environment; this verifies every input Dashboard.tsx's render logic
 * consumes is well-formed for each case, which is what would otherwise
 * surface as a runtime crash or NaN/undefined in the UI.
 * Run with: npx tsx scripts/verifyDashboardScenarios.ts
 */
import { CourseCatalog } from '../src/services/courseCatalog';
import { calculateProgressMetrics } from '../src/services/progressEngine';
import { buildAIContext } from '../src/services/aiContextBuilder';
import { LEGACY_COURSE_IDS } from '../src/models/legacyBridge';
import { DEFAULT_PROFILE } from '../src/models/defaultProfile';
import { Profile } from '../src/models/types';
import { StudyPlanState } from '../src/services/Sync/types';

let failures = 0;
function check(label: string, pass: boolean) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label}`);
  if (!pass) failures++;
}

function emptyState(): StudyPlanState {
  return {
    completedLessons: {}, bookmarks: {}, difficulty: {}, priority: {}, revisionDates: {},
    salary: { current: '', mid: '', target: '' },
    streak: 0, bestStreak: 0, lastStudyDate: null,
    studyLog: {}, lessonsLog: {}, interviewAnswers: {}, journal: [], notes: {},
    completionDates: {}, completionTimes: {},
  } as unknown as StudyPlanState;
}

function runScenario(label: string, profile: Profile, state: StudyPlanState) {
  console.log(`\n--- Scenario: ${label} ---`);
  try {
    const activeCourses = CourseCatalog.getActiveCourses(profile.learningGoals, profile.learningGoalDetails);
    const customGoals = CourseCatalog.getCustomGoals(profile.learningGoals, profile.learningGoalDetails);
    const progressMetrics = calculateProgressMetrics(state, activeCourses);
    const aiContext = buildAIContext(profile, state);

    check(`[${label}] activeCourses is an array`, Array.isArray(activeCourses));
    check(`[${label}] customGoals is an array`, Array.isArray(customGoals));
    check(`[${label}] overall.completionPercentage is a finite number`, Number.isFinite(progressMetrics.overall.completionPercentage));
    check(`[${label}] milestones is an array with valid entries`, Array.isArray(progressMetrics.milestones) && progressMetrics.milestones.every(m => typeof m.daysRemaining === 'number' && !Number.isNaN(m.daysRemaining)));
    check(`[${label}] aiContext.today has a valid windows array`, Array.isArray(aiContext.today.windows));
    check(`[${label}] pacing.status is one of the expected values`, ['ahead', 'behind', 'ontrack'].includes(progressMetrics.pacing.status));
  } catch (err) {
    check(`[${label}] no exception thrown while deriving Dashboard's inputs`, false);
    console.error(err);
  }
}

// --- 1. New user: no goals, no schedule, no history ---
runScenario('New user (no goals/schedule/history)', { ...DEFAULT_PROFILE }, emptyState());

// --- 2. One active learning goal (a real catalog course) ---
runScenario('One active learning goal (PL-300)', {
  ...DEFAULT_PROFILE,
  learningGoals: ['PL-300'],
  workingDays: ['Sun', 'Mon', 'Tue', 'Wed'],
  studyWindows: [{ label: 'Morning', startTime: '07:00', endTime: '07:45', minutes: 45 }],
}, emptyState());

// --- 3. Multiple active learning goals (both real catalog courses, via courseId this time) ---
runScenario('Multiple active goals (PL-300 + PMI-PBA via courseId)', {
  ...DEFAULT_PROFILE,
  learningGoals: ['PL-300', 'PMI-PBA'],
  learningGoalDetails: {
    'PL-300': { courseId: LEGACY_COURSE_IDS.PL300 },
    'PMI-PBA': { courseId: LEGACY_COURSE_IDS.PMIPBA },
  },
  workingDays: ['Sun', 'Mon', 'Tue', 'Wed'],
  studyWindows: [
    { label: 'Morning', startTime: '07:00', endTime: '07:45', minutes: 45 },
    { label: 'Lunch', startTime: '12:00', endTime: '12:45', minutes: 45 },
  ],
}, emptyState());

// --- 4. Custom (non-catalog) learning goals only ---
runScenario('Custom learning goals only (no catalog match)', {
  ...DEFAULT_PROFILE,
  learningGoals: ['CIPD Level 3 Foundation Certificate in People Practice', 'AWS Solutions Architect'],
  workingDays: ['Sun', 'Mon', 'Tue', 'Wed'],
  studyWindows: [{ label: 'Evening', startTime: '19:00', endTime: '20:00', minutes: 60 }],
}, emptyState());

console.log(failures === 0 ? `\nAll checks passed across all 4 scenarios.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
