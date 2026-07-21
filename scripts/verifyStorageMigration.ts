/**
 * Regression verification for the localStorage migration (ROADMAP.md Phase 1,
 * "confirm existing completion/streak/journal data survives migration
 * unchanged"). Run with: npx tsx scripts/verifyStorageMigration.ts
 */
import { loadStudyPlanState } from '../src/models/studyPlanStateMigration';
import { loadProfile } from '../src/models/profileMigration';
import { CURRENT_PROFILE_SCHEMA_VERSION } from '../src/models/profileMigration';
import { PMIPBA_SECTIONS } from '../src/data';

let failures = 0;
function check(label: string, pass: boolean) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label}`);
  if (!pass) failures++;
}

// --- 1. Brand new user (no saved data at all) ---
const fresh = loadStudyPlanState(null);
check('fresh load: schemaVersion stamped', fresh.schemaVersion === 1);
check('fresh load: completedLessons is an empty object before seeding logic runs elsewhere', typeof fresh.completedLessons === 'object');
const preDone = PMIPBA_SECTIONS[0]?.preDone || 0;
const seededCount = Object.keys(fresh.completedLessons).filter(id => id.startsWith('pmipba-s0-l') && fresh.completedLessons[id]).length;
check(`fresh load: PMI-PBA Section 0 preDone seed applied (${seededCount}/${preDone})`, seededCount === preDone);
check('fresh load: _seeded flag set (so it does not re-seed later)', (fresh as any)._seeded === true);

// --- 2. Simulates a REAL pre-existing user's saved blob: unversioned (no
//     schemaVersion field — exactly what every blob saved before this
//     change looks like), with real progress data. ---
const realUserBlob = {
  completedLessons: { 'pl300-s0-l0': true, 'pl300-s0-l1': true, 'pmipba-s0-l0': true },
  bookmarks: { 'pl300-s2-l3': true },
  difficulty: { 'pl300-s2-l3': 3 },
  priority: {},
  revisionDates: { 'pl300-s0-l1': '2026-07-20' },
  salary: { current: 'SAR 15,000', mid: 'SAR 18,500', target: 'SAR 25,000' },
  streak: 12,
  bestStreak: 20,
  lastStudyDate: '2026-07-13',
  studyLog: { '2026-07-13': 45, '2026-07-12': 30 },
  lessonsLog: { '2026-07-13': 2 },
  interviewAnswers: { q1: 'some answer' },
  journal: [{ id: 'err-1', question: 'Q', whyWrong: 'W', correctAnswer: 'C', date: '2026-07-10' }],
  notes: { 'pl300-s0-l0': 'my notes' },
  completionDates: { 'pl300-s0-l0': '2026-07-10' },
  completionTimes: { 'pl300-s0-l0': '08:00' },
  _seeded: true, // this real user already went through the old seed-once check
};

const migrated = loadStudyPlanState(realUserBlob);

check('real blob: schemaVersion stamped to 1', migrated.schemaVersion === 1);
check('real blob: completedLessons preserved exactly', JSON.stringify(migrated.completedLessons) === JSON.stringify(realUserBlob.completedLessons));
check('real blob: streak preserved exactly', migrated.streak === 12 && migrated.bestStreak === 20);
check('real blob: salary preserved exactly', JSON.stringify(migrated.salary) === JSON.stringify(realUserBlob.salary));
check('real blob: studyLog preserved exactly', JSON.stringify(migrated.studyLog) === JSON.stringify(realUserBlob.studyLog));
check('real blob: journal preserved exactly (array identity of content)', JSON.stringify(migrated.journal) === JSON.stringify(realUserBlob.journal));
check('real blob: notes/completionDates/completionTimes preserved exactly',
  JSON.stringify(migrated.notes) === JSON.stringify(realUserBlob.notes) &&
  JSON.stringify(migrated.completionDates) === JSON.stringify(realUserBlob.completionDates) &&
  JSON.stringify(migrated.completionTimes) === JSON.stringify(realUserBlob.completionTimes)
);
check('real blob: already-seeded user is NOT re-seeded (no double-counting)',
  Object.keys(migrated.completedLessons).filter(id => id.startsWith('pmipba-s0-l')).length ===
  Object.keys(realUserBlob.completedLessons).filter(id => id.startsWith('pmipba-s0-l')).length
);

// --- 3. Idempotency: migrating an already-current-version blob a second time changes nothing ---
const twiceMigrated = loadStudyPlanState(migrated);
check('idempotent: migrating an already-v1 blob again produces identical data',
  JSON.stringify(twiceMigrated) === JSON.stringify(migrated));

// --- 4. Corrupt/null JSON handled the same as "no data" (fresh state, not a crash) ---
const fromNull = loadStudyPlanState(null);
check('null input does not throw and returns a valid default state', fromNull.schemaVersion === 1);

// --- 5. Profile migration: same idempotency + default-fill guarantee ---
const freshProfile = loadProfile(null);
check('profile: fresh load stamps schemaVersion', freshProfile.schemaVersion === CURRENT_PROFILE_SCHEMA_VERSION);
const savedProfile = { name: 'Custom Name', country: 'Custom Country' };
const migratedProfile = loadProfile(savedProfile);
check('profile: saved fields preserved', migratedProfile.name === 'Custom Name' && migratedProfile.country === 'Custom Country');
check('profile: missing fields filled from DEFAULT_PROFILE', Array.isArray(migratedProfile.workingDays));

console.log(failures === 0 ? `\nAll checks passed. Existing user data survives the migration unchanged.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
