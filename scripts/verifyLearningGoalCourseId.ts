/**
 * Verification for the learning-goal ecosystem incremental fixes:
 *   1. PMI-PBA missing from the searchable goal library
 *   2. courseId-preferring exact matching, replacing pure fuzzy text matching
 *   3. Backward compatibility (goals/profiles without courseId still work)
 * Run with: npx tsx scripts/verifyLearningGoalCourseId.ts
 */
import { CourseCatalog } from '../src/services/courseCatalog';
import { LEGACY_COURSE_IDS, getLegacyCourseById } from '../src/models/legacyBridge';
import { InMemoryGoalSearchProvider } from '../src/onboarding/steps/goalSearch';
import { buildLearningGoalPatch } from '../src/onboarding/steps/learningGoalState';

let failures = 0;
function check(label: string, pass: boolean) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label}`);
  if (!pass) failures++;
}

// --- Bug #1: PMI-PBA was entirely missing from the searchable goal library ---
async function checkGoalSearch() {
  const provider = new InMemoryGoalSearchProvider();

  const pmiResults = await provider.search('pmi-pba');
  check('searching "pmi-pba" finds the real PMI-PBA entry', pmiResults.some(e => e.courseId === LEGACY_COURSE_IDS.PMIPBA));

  const businessResults = await provider.search('business analysis');
  check('searching "business analysis" finds PMI-PBA specifically, not just CBAP', businessResults.some(e => e.courseId === LEGACY_COURSE_IDS.PMIPBA));

  const popular = await provider.getPopularGoals();
  check('PMI-PBA appears in popular goals (both real catalog courses should, not just PL-300)', popular.some(e => e.courseId === LEGACY_COURSE_IDS.PMIPBA));
  check('PL-300 also still appears in popular goals', popular.some(e => e.courseId === LEGACY_COURSE_IDS.PL300));

  const plResults = await provider.search('pl-300');
  check('PL-300 entries carry the real courseId', plResults.every(e => !e.label.includes('PL-300') || e.courseId === LEGACY_COURSE_IDS.PL300));
}

// --- courseId-preferring matching ---
function checkCourseIdMatching() {
  const pmiCourse = getLegacyCourseById(LEGACY_COURSE_IDS.PMIPBA)!;
  const plCourse = getLegacyCourseById(LEGACY_COURSE_IDS.PL300)!;

  // A goal whose label text would NOT fuzzy-match PMI-PBA at all, but has an
  // explicit courseId pointing at it — proves courseId is actually being used,
  // not just coincidentally agreeing with fuzzy matching.
  const nonMatchingLabel = 'My Business Requirements Goal';
  const details = { [nonMatchingLabel]: { courseId: LEGACY_COURSE_IDS.PMIPBA } };
  check('goal with courseId matches its course even when the label text would never fuzzy-match', CourseCatalog.isCourseActive(pmiCourse, [nonMatchingLabel], details));
  check('that same goal does NOT also match a different course', !CourseCatalog.isCourseActive(plCourse, [nonMatchingLabel], details));

  // Guard: a goal with an explicit courseId should NOT also get a second,
  // looser fuzzy-match chance against a different course whose name it
  // happens to textually resemble.
  const trickyLabel = 'PL-300 adjacent training (actually about PMI-PBA)';
  const trickyDetails = { [trickyLabel]: { courseId: LEGACY_COURSE_IDS.PMIPBA } };
  check('a goal with courseId set is NOT fuzzy-matched against a different course even if its label text resembles one', !CourseCatalog.isCourseActive(plCourse, [trickyLabel], trickyDetails));
  check('...but still correctly matches its actual assigned course', CourseCatalog.isCourseActive(pmiCourse, [trickyLabel], trickyDetails));
}

// --- Backward compatibility: no learningGoalDetails, or goals without courseId ---
function checkBackwardCompatibility() {
  // No learningGoalDetails argument at all (old call sites, or code not yet updated)
  check('old-style call with no learningGoalDetails arg still works (fuzzy matching)', CourseCatalog.isCourseActive(getLegacyCourseById(LEGACY_COURSE_IDS.PL300)!, ['PL-300']));

  // learningGoalDetails present but this particular goal has no entry in it
  const partialDetails = { 'Some Other Goal': { courseId: LEGACY_COURSE_IDS.PMIPBA } };
  check('a goal not present in learningGoalDetails still falls back to fuzzy matching', CourseCatalog.isCourseActive(getLegacyCourseById(LEGACY_COURSE_IDS.PL300)!, ['PL-300'], partialDetails));

  // Mixed: one goal with courseId, one legacy fuzzy-only goal, both should resolve correctly
  const mixedGoals = ['My Business Requirements Goal', 'PL-300'];
  const mixedDetails = { 'My Business Requirements Goal': { courseId: LEGACY_COURSE_IDS.PMIPBA } };
  check('mixed goal list: courseId-based AND fuzzy-based goals both resolve correctly', 
    CourseCatalog.isCourseActive(getLegacyCourseById(LEGACY_COURSE_IDS.PMIPBA)!, mixedGoals, mixedDetails) &&
    CourseCatalog.isCourseActive(getLegacyCourseById(LEGACY_COURSE_IDS.PL300)!, mixedGoals, mixedDetails)
  );
}

// --- learningGoalState.ts: the meta-storage bug fix (courseId alone should not be dropped) ---
function checkGoalStatePatch() {
  const patch = buildLearningGoalPatch({
    existingGoals: [],
    existingDetails: {},
    goal: 'PMI-PBA: Business Analysis',
    meta: { courseId: LEGACY_COURSE_IDS.PMIPBA }, // no category, no url — only courseId
  });
  check('a goal added with ONLY courseId (no category/url) is not silently dropped from learningGoalDetails', 
    patch.learningGoalDetails['PMI-PBA: Business Analysis']?.courseId === LEGACY_COURSE_IDS.PMIPBA);
}

async function main() {
  await checkGoalSearch();
  checkCourseIdMatching();
  checkBackwardCompatibility();
  checkGoalStatePatch();
  console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
