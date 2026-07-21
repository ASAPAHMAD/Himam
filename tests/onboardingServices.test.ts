import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryGoalSearchProvider } from '../src/onboarding/steps/goalSearch';
import { DEFAULT_PROFILE } from '../src/models/defaultProfile';
import { getCountryTimezones, getDefaultTimezoneForCountry, getTimezoneDisplayLabel } from '../src/services/timezone';

test('finds CIPD and PMP goals from partial input', async () => {
  const provider = new InMemoryGoalSearchProvider();

  const cipdResults = await provider.search('cipd');
  assert.ok(cipdResults.some(entry => entry.label.includes('CIPD Level 3')));

  const pmpResults = await provider.search('pmp');
  assert.ok(pmpResults.some(entry => entry.label.includes('PMP')));
});

test('uses fuzzy matching for related terms like cyber security', async () => {
  const provider = new InMemoryGoalSearchProvider();
  const results = await provider.search('cyber sec');
  assert.ok(results.some(entry => entry.label.toLowerCase().includes('cyber')));
});

test('returns a default timezone for a known country', () => {
  assert.equal(getDefaultTimezoneForCountry('Saudi Arabia'), 'Asia/Riyadh');
  assert.equal(getDefaultTimezoneForCountry('United Kingdom'), 'Europe/London');
  assert.equal(getDefaultTimezoneForCountry('United States'), 'America/New_York');
});

test('returns multiple timezones when a country spans several zones', () => {
  const timezones = getCountryTimezones('United States');
  assert.ok(timezones.includes('America/New_York'));
  assert.ok(timezones.includes('America/Los_Angeles'));
});

test('formats timezone labels for onboarding without exposing the IANA name', () => {
  assert.equal(getTimezoneDisplayLabel('Asia/Riyadh'), '(GMT+03:00) Riyadh');
});

test('returns broader international certifications and degrees for worldwide learners', async () => {
  const provider = new InMemoryGoalSearchProvider();
  const results = await provider.search('cisco ccna mba accounting cfa');

  assert.ok(results.some(entry => entry.label.toLowerCase().includes('ccna')));
  assert.ok(results.some(entry => entry.label.toLowerCase().includes('mba')));
  assert.ok(results.some(entry => entry.label.toLowerCase().includes('accounting')));
  assert.ok(results.some(entry => entry.label.toLowerCase().includes('cfa')));
});

test('starts a new profile with blank onboarding fields so the user fills everything in', () => {
  assert.equal(DEFAULT_PROFILE.name, '');
  assert.equal(DEFAULT_PROFILE.country, '');
  assert.equal(DEFAULT_PROFILE.timezone, '');
  assert.deepEqual(DEFAULT_PROFILE.workingDays, []);
  assert.deepEqual(DEFAULT_PROFILE.studyWindows, []);
});
