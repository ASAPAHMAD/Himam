/**
 * Verification for Achievements.tsx's migration off LEGACY_COURSE_IDS onto
 * the generic CourseCatalog/learningGoals model (post-review Milestone 1).
 * Run with: npx tsx scripts/verifyAchievementsCourseIdentity.ts
 */
import { CourseCatalog } from '../src/services/courseCatalog';
import { LEGACY_COURSE_IDS } from '../src/models/legacyBridge';

let failures = 0;
function check(label: string, pass: boolean) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label}`);
  if (!pass) failures++;
}

// --- A learner with no PL-300/PMI-PBA goal gets zero active legacy courses,
// not a crash or a permanently-locked badge for content they never selected ---
const customOnlyGoals = ['CIPD Level 3 Foundation Certificate in People Practice'];
const activeForCustom = CourseCatalog.getActiveCourses(customOnlyGoals);
check('learner with only a custom goal has 0 active catalog courses (no PL-300/PMI-PBA badges should render)', activeForCustom.length === 0);
check('the custom goal itself is NOT swallowed into "active courses" (would double-count otherwise)', !activeForCustom.some(c => customOnlyGoals.includes(c.name)));
const customGoalsList = CourseCatalog.getCustomGoals(customOnlyGoals);
check('the custom goal is correctly classified as a custom goal, not lost', customGoalsList.length === 1);

// --- A learner with only PL-300 gets exactly PL-300 active, PMI-PBA absent ---
const plOnly = CourseCatalog.getActiveCourses(['PL-300']);
check('learner with only PL-300 goal: PL-300 active', plOnly.some(c => c.id === LEGACY_COURSE_IDS.PL300));
check('learner with only PL-300 goal: PMI-PBA NOT active (so "BA Analyst" badge should not render for them)', !plOnly.some(c => c.id === LEGACY_COURSE_IDS.PMIPBA));

// --- A learner with both gets both, in any order/casing ---
const both = CourseCatalog.getActiveCourses(['pl-300', 'PMI-PBA']);
check('learner with both goals (case-insensitive match): both courses active', both.length === 2);

// --- A learner with a mix of one real course + one custom goal ---
const mixed = CourseCatalog.getActiveCourses(['PL-300', 'AWS Solutions Architect']);
check('mixed goals: exactly 1 catalog course active (PL-300)', mixed.length === 1 && mixed[0].id === LEGACY_COURSE_IDS.PL300);
const mixedCustom = CourseCatalog.getCustomGoals(['PL-300', 'AWS Solutions Architect']);
check('mixed goals: exactly 1 custom goal (AWS), PL-300 not misclassified as custom', mixedCustom.length === 1 && mixedCustom[0] === 'AWS Solutions Architect');

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
