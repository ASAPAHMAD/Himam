/**
 * Verification for the onboarding fields migration (models/profileMigration.ts).
 * This is exactly the class of subtle bug our verification scripts exist to
 * catch: distinguishing "brand new user" from "existing user who predates
 * this feature" from "user genuinely mid-onboarding, must resume correctly."
 * Run with: npx tsx scripts/verifyOnboardingMigration.ts
 */
import { loadProfile } from '../src/models/profileMigration';

let failures = 0;
function check(label: string, pass: boolean) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label}`);
  if (!pass) failures++;
}

// --- 1. Brand new user: no saved data at all ---
const brandNew = loadProfile(null);
check('brand new user: onboardingCompleted = false', brandNew.onboardingCompleted === false);
check('brand new user: onboardingStep = identity', brandNew.onboardingStep === 'identity');

// --- 2. Existing real user from before this feature existed: real saved
//     data, no onboarding fields at all (exactly what a Phase 1.5 profile
//     looks like) ---
const preExistingRealUser = {
  id: 'user-real-1', name: 'Someone Real', country: 'Egypt', timezone: 'Africa/Cairo',
  careerGoal: 'Become a PM', currentJob: 'Coordinator', targetJob: 'PM',
  currentSalary: '', targetSalary: '', learningGoals: ['PMP'],
  workingDays: ['Sun', 'Mon'], vacationRanges: [], holidays: [], extraWorkingDays: [],
  studyWindows: [{ label: 'Evening', minutes: 60 }], learningStyle: 'Reading',
  schemaVersion: 1,
  // deliberately no onboardingCompleted / onboardingStep — this is the point
};
const grandfathered = loadProfile(preExistingRealUser);
check('grandfathered existing user: onboardingCompleted = true (not retroactively interrupted)', grandfathered.onboardingCompleted === true);
check('grandfathered existing user: onboardingStep = complete', grandfathered.onboardingStep === 'complete');
check('grandfathered existing user: real fields preserved, not reset to defaults', grandfathered.name === 'Someone Real' && grandfathered.country === 'Egypt' && grandfathered.learningGoals[0] === 'PMP');

// --- 3. User genuinely mid-onboarding: closed the app partway through ---
const midOnboarding = {
  id: 'user-mid-1', name: 'Partial User', country: '', timezone: '',
  careerGoal: '', currentJob: '', targetJob: '', currentSalary: '', targetSalary: '',
  learningGoals: [], workingDays: [], vacationRanges: [], holidays: [], extraWorkingDays: [],
  studyWindows: [], learningStyle: 'Mixed',
  onboardingCompleted: false,
  onboardingStep: 'career', // they finished step 1 (identity) and closed the app during step 2
  schemaVersion: 2,
};
const resumed = loadProfile(midOnboarding);
check('mid-onboarding user resumes at their exact saved step, NOT grandfathered to complete', resumed.onboardingCompleted === false && resumed.onboardingStep === 'career');

// --- 4. User who genuinely completed onboarding for real (post-feature) ---
const genuinelyComplete = { ...midOnboarding, onboardingCompleted: true, onboardingStep: 'complete' as const };
const stillComplete = loadProfile(genuinelyComplete);
check('genuinely-completed user stays complete', stillComplete.onboardingCompleted === true && stillComplete.onboardingStep === 'complete');

// --- 5. Idempotency ---
const twice = loadProfile(resumed);
check('idempotent: loading an already-migrated mid-onboarding profile again changes nothing', twice.onboardingCompleted === false && twice.onboardingStep === 'career');

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
