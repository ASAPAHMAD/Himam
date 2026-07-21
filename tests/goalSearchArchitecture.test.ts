import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  InMemoryGoalSearchProvider, 
  CompositeGoalSearchProvider,
  scoreEntryWithAlias
} from '../src/onboarding/steps/goalSearch';

test('scoring with aliases is highly relevant and accurate', () => {
  const pl300Entry = {
    id: 'pl-300',
    label: 'PL-300: Power BI Data Analyst',
    category: 'Certifications',
    aliases: ['Power BI', 'PL-300', 'Microsoft PL-300', 'Power BI Data Analyst']
  };

  const exactMatch = scoreEntryWithAlias(pl300Entry, 'microsoft pl-300');
  assert.equal(exactMatch.score, 150);
  assert.equal(exactMatch.confidence, 1.0);

  const exactAliasMatch = scoreEntryWithAlias(pl300Entry, 'power bi');
  assert.equal(exactAliasMatch.score, 150);
  assert.equal(exactAliasMatch.confidence, 1.0);

  const containsMatch = scoreEntryWithAlias(pl300Entry, 'microsoft');
  assert.equal(containsMatch.score, 130);
  assert.equal(containsMatch.confidence, 0.95);

  const partialMatch = scoreEntryWithAlias(pl300Entry, 'analyst');
  assert.ok(partialMatch.score > 0);
  assert.ok(partialMatch.confidence > 0 && partialMatch.confidence <= 1.0);
});

test('InMemoryGoalSearchProvider returns score, confidence, and source metadata', async () => {
  const provider = new InMemoryGoalSearchProvider();
  const results = await provider.search('power bi');

  assert.ok(results.length > 0);
  const first = results[0];
  assert.equal(first.id, 'pl-300');
  assert.ok(first.score !== undefined && first.score > 0);
  assert.ok(first.confidence !== undefined && first.confidence > 0);
  assert.equal(first.source, 'local-catalog');
});

test('CompositeGoalSearchProvider merges and ranks duplicates correctly', async () => {
  // Define mock providers
  const p1 = new InMemoryGoalSearchProvider();
  const p2 = new InMemoryGoalSearchProvider();

  const composite = new CompositeGoalSearchProvider([p1, p2]);
  const results = await composite.search('power bi');

  // Should only have one result for pl-300 because of merging
  const pl300Results = results.filter(r => r.id === 'pl-300');
  assert.equal(pl300Results.length, 1);
  
  const merged = pl300Results[0];
  assert.equal(merged.source, 'local-catalog'); // combined from both providers
  assert.ok(merged.score !== undefined && merged.score > 0);
  assert.ok(merged.confidence !== undefined && merged.confidence > 0);
});

test('GoalSearchEntry carries rich metadata for key standard goals', async () => {
  const provider = new InMemoryGoalSearchProvider();
  
  // Test PL-300 metadata
  const resultsPL = await provider.search('PL-300');
  assert.ok(resultsPL.length > 0);
  const pl300 = resultsPL.find(r => r.id === 'pl-300');
  assert.ok(pl300);
  assert.ok(pl300.metadata);
  assert.equal(pl300.metadata.providerName, 'Microsoft');
  assert.equal(pl300.metadata.estimatedHours, 120);
  assert.equal(pl300.metadata.difficulty, 'Intermediate');
  assert.ok(pl300.metadata.skillsCovered && pl300.metadata.skillsCovered.includes('Power Query'));

  // Test PMP metadata
  const resultsPMP = await provider.search('PMP');
  assert.ok(resultsPMP.length > 0);
  const pmp = resultsPMP.find(r => r.id === 'pmp');
  assert.ok(pmp);
  assert.ok(pmp.metadata);
  assert.equal(pmp.metadata.estimatedDuration, '10 Weeks');
  assert.equal(pmp.metadata.difficulty, 'Advanced');
});
