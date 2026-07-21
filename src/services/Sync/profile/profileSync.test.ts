import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE } from '../../../models/defaultProfile';
import {
  diffProfileFields,
  enqueueProfileChanges,
  PROFILE_FIELD_MAPPINGS,
  createSyncEngine,
} from '..';


const USER_ID = 'user_profile_sync_test';

test('diffProfileFields returns no diffs when nothing changed', () => {
  const diffs = diffProfileFields(USER_ID, DEFAULT_PROFILE, { ...DEFAULT_PROFILE });
  assert.equal(diffs.length, 0);
});

test('diffProfileFields detects a single changed field', () => {
  const next = { ...DEFAULT_PROFILE, timezone: 'Asia/Riyadh' };
  const diffs = diffProfileFields(USER_ID, DEFAULT_PROFILE, next);

  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].field, 'timezone');
  assert.equal(diffs[0].payload.column, 'timezone');
  assert.equal(diffs[0].payload.value, 'Asia/Riyadh');
  assert.equal(diffs[0].payload.userId, USER_ID);
});

test('diffProfileFields detects multiple changed fields independently', () => {
  const next = { ...DEFAULT_PROFILE, name: 'Ahmad', currentJob: 'Senior EA', targetJob: 'Data Analyst' };
  const diffs = diffProfileFields(USER_ID, DEFAULT_PROFILE, next);

  const fields = diffs.map((d) => d.field).sort();
  assert.deepEqual(fields, ['currentJob', 'name', 'targetJob'].sort());
});

test('diffProfileFields maps learningGoals to the certifications column (historical naming preserved)', () => {
  const next = { ...DEFAULT_PROFILE, learningGoals: ['PL-300', 'PMI-PBA'] };
  const diffs = diffProfileFields(USER_ID, DEFAULT_PROFILE, next);

  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].field, 'learningGoals');
  assert.equal(diffs[0].payload.column, 'certifications');
  assert.deepEqual(diffs[0].payload.value, ['PL-300', 'PMI-PBA']);
});

test('diffProfileFields detects learningGoalDetails object changes', () => {
  const next = {
    ...DEFAULT_PROFILE,
    learningGoalDetails: { 'PL-300': { category: 'Data', courseId: 'course_pl300' } },
  };
  const diffs = diffProfileFields(USER_ID, DEFAULT_PROFILE, next);

  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].field, 'learningGoalDetails');
  assert.equal(diffs[0].payload.column, 'learning_goal_details');
  assert.deepEqual(diffs[0].payload.value, { 'PL-300': { category: 'Data', courseId: 'course_pl300' } });
});

test('diffProfileFields ignores fields with no cloud column (customCourses, username, etc.)', () => {
  const next = {
    ...DEFAULT_PROFILE,
    username: 'ahmad123',
    customCourses: [{ id: 'course_x', name: 'X', mode: 'ai' as const, color: '#fff', examDate: null, createdAt: new Date().toISOString(), sections: [] }],
  };
  const diffs = diffProfileFields(USER_ID, DEFAULT_PROFILE, next);
  assert.equal(diffs.length, 0);
});

test('diffProfileFields applies the same null-coalescing rules as profileToRow (avatarUrl, learningStyle)', () => {
  const withAvatar = { ...DEFAULT_PROFILE, avatarUrl: 'https://example.com/a.png' };
  const diffs = diffProfileFields(USER_ID, DEFAULT_PROFILE, withAvatar);
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].payload.value, 'https://example.com/a.png');

  // Unsetting it back should diff to null, not undefined, matching
  // profileToRow's `profile.avatarUrl ?? null`.
  const diffsBack = diffProfileFields(USER_ID, withAvatar, DEFAULT_PROFILE);
  assert.equal(diffsBack.length, 1);
  assert.equal(diffsBack[0].payload.value, null);
});

test('PROFILE_FIELD_MAPPINGS covers every column profileToRow already writes', () => {
  const mappedFields = PROFILE_FIELD_MAPPINGS.map((m) => m.field).sort();
  const expected = [
    'name', 'avatarUrl', 'country', 'timezone', 'careerGoal', 'currentJob', 'targetJob',
    'currentSalary', 'targetSalary', 'learningGoals', 'learningGoalDetails', 'workingDays',
    'vacationRanges', 'holidays', 'extraWorkingDays', 'studyWindows', 'learningStyle',
    'onboardingCompleted', 'onboardingStep',
  ].sort();
  assert.deepEqual(mappedFields, expected);
});

test('enqueueProfileChanges enqueues exactly one SyncEngine entry per changed field', async () => {
  const engine = createSyncEngine();
  const next = { ...DEFAULT_PROFILE, name: 'Ahmad', timezone: 'Asia/Riyadh' };

  const entries = await enqueueProfileChanges(engine, USER_ID, DEFAULT_PROFILE, next);

  assert.equal(entries.length, 2);
  assert.equal(engine.pending().length, 2);
  assert.ok(engine.pending().every((e) => e.entityType === 'profile_field'));
  const columns = engine.pending().map((e) => (e.payload as { column: string }).column).sort();
  assert.deepEqual(columns, ['name', 'timezone'].sort());
});

test('enqueueProfileChanges enqueues nothing when profiles are identical', async () => {
  const engine = createSyncEngine();
  const entries = await enqueueProfileChanges(engine, USER_ID, DEFAULT_PROFILE, { ...DEFAULT_PROFILE });

  assert.equal(entries.length, 0);
  assert.equal(engine.pending().length, 0);
  assert.equal(engine.status().name, 'idle');
});
