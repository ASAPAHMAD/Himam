/**
 * Verification for cloud persistence mapping (models/cloudPersistence.ts).
 * Tests the pure mapping functions only — no live Supabase connection needed,
 * since that's exactly where a field-name or shape bug would actually live.
 * Run with: npx tsx scripts/verifyCloudPersistence.ts
 */
import { profileToRow, rowToProfile, progressToRows, rowsToProgress } from '../src/models/cloudPersistence';
import { userProgressToLegacyState, legacyStateToUserProgress } from '../src/models/migrateLegacy';
import { DEFAULT_PROFILE } from '../src/models/defaultProfile';
import { UserProgress } from '../src/models/types';
import { StudyPlanState } from '../src/services/Sync/types';

let failures = 0;
function check(label: string, pass: boolean) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label}`);
  if (!pass) failures++;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a === 'object') {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (JSON.stringify(aKeys) !== JSON.stringify(bKeys)) return false;
    return aKeys.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}

// --- Profile round-trip ---
const userId = 'test-user-uuid-1234';
const profileWithAvatar = { ...DEFAULT_PROFILE, id: userId, avatarUrl: 'https://example.com/a.png' };
const row = profileToRow(userId, profileWithAvatar);
const roundTripped = rowToProfile(row);

// local-only fields are not synced to the cloud and are not expected to round-trip
const expectedProfile = { ...profileWithAvatar };
delete expectedProfile.username;
delete expectedProfile.dailyGoalMinutes;

check('profile round-trips through DB row shape (all fields, order-independent)', deepEqual(roundTripped, expectedProfile));

const profileNoAvatar = { ...DEFAULT_PROFILE, id: userId, avatarUrl: undefined };
const rowNoAvatar = profileToRow(userId, profileNoAvatar);
check('missing avatarUrl maps to null, not undefined (valid for a DB column)', rowNoAvatar.avatar_url === null);
const roundTrippedNoAvatar = rowToProfile(rowNoAvatar);
check('null avatar_url round-trips back to undefined avatarUrl', roundTrippedNoAvatar.avatarUrl === undefined);

// --- UserProgress <-> rows round-trip ---
const sampleProgress: UserProgress = {
  lessonStatus: { 'pl300-s0-l0': 'completed', 'pl300-s0-l1': 'in_progress' },
  bookmarks: { 'pl300-s2-l3': true },
  difficultyRating: { 'pl300-s2-l3': 3 },
  priority: { 'pl300-s0-l0': 'High', 'pl300-s0-l1': 'Low' },
  revisionDates: { 'pl300-s0-l1': '2026-07-20' },
  notes: { 'pl300-s0-l0': 'remember this' },
  completionDates: { 'pl300-s0-l0': '2026-07-10' },
  completionTimes: { 'pl300-s0-l0': '08:00' },
};
// 3 unique lesson ids referenced across all dicts: pl300-s0-l0, pl300-s0-l1, pl300-s2-l3
const rows = progressToRows(userId, sampleProgress);
check('progressToRows produces one row per referenced lesson id (3 unique ids)', rows.length === 3);
const backToProgress = rowsToProgress(rows);
check('bookmarks round-trip', deepEqual(backToProgress.bookmarks, sampleProgress.bookmarks));
check('difficultyRating round-trips', deepEqual(backToProgress.difficultyRating, sampleProgress.difficultyRating));
check('priority round-trips (including non-High values)', deepEqual(backToProgress.priority, sampleProgress.priority));
check('revisionDates round-trip', deepEqual(backToProgress.revisionDates, sampleProgress.revisionDates));
check('notes round-trip', deepEqual(backToProgress.notes, sampleProgress.notes));
check('completionDates/Times round-trip', deepEqual(backToProgress.completionDates, sampleProgress.completionDates) && deepEqual(backToProgress.completionTimes, sampleProgress.completionTimes));
// lessonStatus is asymmetric by design: only 'completed' round-trips through legacy boolean
// completedLessons (see userProgressToLegacyCompletedLessons) — 'in_progress' has no legacy
// equivalent yet, since no component writes it. Verify what DOES round-trip:
check('completed lessonStatus round-trips', backToProgress.lessonStatus['pl300-s0-l0'] === 'completed');

// --- Full legacy <-> UserProgress <-> legacy round-trip, preserving non-progress fields ---
const baseState = {
  completedLessons: {}, bookmarks: {}, difficulty: {}, priority: {}, revisionDates: {},
  salary: { current: 'SAR 15,000', mid: 'SAR 18,500', target: 'SAR 25,000' },
  streak: 12, bestStreak: 20, lastStudyDate: '2026-07-13',
  studyLog: { '2026-07-13': 45 }, lessonsLog: {}, interviewAnswers: {}, journal: [], notes: {},
  completionDates: {}, completionTimes: {},
} as unknown as StudyPlanState;

const progressFromLegacy = legacyStateToUserProgress({ ...baseState, completedLessons: { 'pl300-s0-l0': true }, bookmarks: { 'pl300-s2-l3': true } } as StudyPlanState);
const mergedBack = userProgressToLegacyState(progressFromLegacy, baseState);
check('non-progress fields preserved from base (streak/salary/studyLog untouched)', mergedBack.streak === 12 && mergedBack.salary.current === 'SAR 15,000' && JSON.stringify(mergedBack.studyLog) === JSON.stringify({ '2026-07-13': 45 }));
check('progress fields applied from cloud data', mergedBack.completedLessons['pl300-s0-l0'] === true && mergedBack.bookmarks['pl300-s2-l3'] === true);

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
