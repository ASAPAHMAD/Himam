import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IndexedDbOutboxStore,
  isIndexedDbAvailable,
  getDefaultOutboxStore,
  createSyncEngine,
  SyncEntry,
} from '../src/services/Sync';


test('isIndexedDbAvailable() is true once fake-indexeddb is polyfilled', () => {
  assert.equal(isIndexedDbAvailable(), true);
});

test('getDefaultOutboxStore() picks IndexedDbOutboxStore when indexedDB is available', () => {
  const store = getDefaultOutboxStore();
  assert.ok(store instanceof IndexedDbOutboxStore);
});

test('add() then list() returns the stored entry', async () => {
  const store = new IndexedDbOutboxStore();
  const entry: SyncEntry = {
    id: 'sync_test_1',
    entityType: 'course_save',
    payload: { title: 'Persisted Course' },
    createdAt: Date.now(),
    attempts: 0,
  };
  await store.add(entry);

  const all = await store.list();
  assert.equal(all.length, 1);
  assert.equal(all[0].id, 'sync_test_1');
  assert.deepEqual(all[0].payload, { title: 'Persisted Course' });
});

test('update() overwrites attempts and lastError on an existing entry', async () => {
  const store = new IndexedDbOutboxStore();
  const entry: SyncEntry = {
    id: 'sync_test_2',
    entityType: 'lesson_progress',
    payload: {},
    createdAt: Date.now(),
    attempts: 0,
  };
  await store.add(entry);
  await store.update({ ...entry, attempts: 2, lastError: 'network timeout' });

  const all = await store.list();
  const found = all.find((e) => e.id === 'sync_test_2');
  assert.equal(found?.attempts, 2);
  assert.equal(found?.lastError, 'network timeout');
});

test('remove() deletes an entry', async () => {
  const store = new IndexedDbOutboxStore();
  const entry: SyncEntry = {
    id: 'sync_test_3',
    entityType: 'profile_field',
    payload: {},
    createdAt: Date.now(),
    attempts: 0,
  };
  await store.add(entry);
  await store.remove('sync_test_3');

  const all = await store.list();
  assert.equal(all.some((e) => e.id === 'sync_test_3'), false);
});

test('list() returns entries ordered by createdAt', async () => {
  const store = new IndexedDbOutboxStore();
  const base = Date.now();
  await store.add({ id: 'sync_order_2', entityType: 'course_save', payload: {}, createdAt: base + 200, attempts: 0 });
  await store.add({ id: 'sync_order_1', entityType: 'course_save', payload: {}, createdAt: base + 100, attempts: 0 });
  await store.add({ id: 'sync_order_3', entityType: 'course_save', payload: {}, createdAt: base + 300, attempts: 0 });

  const all = await store.list();
  const ordered = all.filter((e) => e.id.startsWith('sync_order_')).map((e) => e.id);
  assert.deepEqual(ordered, ['sync_order_1', 'sync_order_2', 'sync_order_3']);
});

test('persistence survives across separate store instances (simulated reload)', async () => {
  const storeA = new IndexedDbOutboxStore();
  await storeA.add({
    id: 'sync_reload_1',
    entityType: 'course_save',
    payload: { title: 'Survives Reload' },
    createdAt: Date.now(),
    attempts: 0,
  });

  // A fresh instance, as if the page reloaded and SyncEngine were
  // reconstructed from scratch — same underlying IndexedDB database.
  const storeB = new IndexedDbOutboxStore();
  const all = await storeB.list();
  assert.ok(all.some((e) => e.id === 'sync_reload_1'));
});

test('DefaultSyncEngine now persists queued entries via IndexedDB by default', async () => {
  const engine1 = createSyncEngine();
  await engine1.enqueue({ entityType: 'course_save', payload: { title: 'Engine Persistence' } });

  // Simulate app restart: a brand-new engine instance, no explicit store
  // injected, relying on the same default (IndexedDB) selection.
  const engine2 = createSyncEngine();
  await engine2.drain(); // drain() refreshes its cache from the store before acting
  assert.equal(engine2.pending().length >= 1, true);
  assert.ok(engine2.pending().some((e) => e.payload && (e.payload as { title?: string }).title === 'Engine Persistence'));
});
