import test from 'node:test';
import assert from 'node:assert/strict';
import {
  finishIngredientSync,
  markIngredientsDirty,
  mergeIngredientSnapshots,
  normalizeSyncMetadata,
} from '../src/utils/syncState.js';

test('offline local rows win conflicts while remote-only additions survive', () => {
  const merged = mergeIngredientSnapshots({
    cloudIngredients: [
      { id: 'shared', amount: 2 },
      { id: 'remote-only', amount: 1 },
    ],
    localIngredients: [
      { id: 'shared', amount: 5 },
      { id: 'local-only', amount: 3 },
    ],
  });

  assert.deepEqual(merged, [
    { id: 'shared', amount: 5 },
    { id: 'remote-only', amount: 1 },
    { id: 'local-only', amount: 3 },
  ]);
});

test('explicit tombstones remove only the intended cloud rows', () => {
  const merged = mergeIngredientSnapshots({
    cloudIngredients: [
      { id: 'deleted', amount: 1 },
      { id: 'keep', amount: 1 },
    ],
    localIngredients: [],
    deletedIngredientIds: ['deleted'],
  });
  assert.deepEqual(merged, [{ id: 'keep', amount: 1 }]);
});

test('dirty metadata persists deletions until a successful sync', () => {
  const dirty = markIngredientsDirty(
    normalizeSyncMetadata(null),
    [{ id: 'a' }, { id: 'b' }],
    [{ id: 'b' }]
  );
  assert.equal(dirty.ingredientsDirty, true);
  assert.deepEqual(dirty.deletedIngredientIds, ['a']);

  const finished = finishIngredientSync(dirty, ['a']);
  assert.equal(finished.ingredientsDirty, false);
  assert.deepEqual(finished.deletedIngredientIds, []);
});

import {
  buildFingerprintMap,
  getRowsToUpload,
} from '../src/utils/syncState.js';

const milk = {
  id: 'milk',
  name: '牛奶',
  amount: 1,
  unit: '盒',
  storage: 'fridge',
  shelfLife: 7,
  purchaseDate: '2026-11-12',
};
const eggs = { ...milk, id: 'eggs', name: '鸡蛋', unit: '个', amount: 6 };

test('only rows that differ from the cloud are uploaded', () => {
  // This device loaded milk and eggs. Another device then deleted eggs.
  const cloud = buildFingerprintMap([milk, eggs]);
  const local = [{ ...milk, amount: 2 }, eggs];
  // Editing milk must not upload (and so resurrect) the unchanged eggs row.
  assert.deepEqual(
    getRowsToUpload(local, cloud).map((item) => item.id),
    ['milk']
  );
});

test('cloud rows mapped back from the database count as unchanged', () => {
  const fromDB = {
    ...milk,
    category: 'other',
    shelf_life: 7,
    purchase_date: '2026-11-12',
  };
  assert.deepEqual(getRowsToUpload([milk], buildFingerprintMap([fromDB])), []);
});

test('offline merge keeps local edits but drops rows deleted elsewhere', () => {
  const dirty = markIngredientsDirty(
    normalizeSyncMetadata(null),
    [milk, eggs],
    [{ ...milk, amount: 3 }, eggs]
  );
  assert.deepEqual(dirty.dirtyIngredientIds, ['milk']);

  const merged = mergeIngredientSnapshots({
    cloudIngredients: [milk], // eggs was deleted on another device
    localIngredients: [{ ...milk, amount: 3 }, eggs],
    deletedIngredientIds: dirty.deletedIngredientIds,
    dirtyIngredientIds: dirty.dirtyIngredientIds,
  });
  assert.deepEqual(merged, [{ ...milk, amount: 3 }]);
});

test('older metadata without row ids keeps the previous merge behaviour', () => {
  const legacy = normalizeSyncMetadata({ ingredientsDirty: true });
  assert.equal(legacy.dirtyIngredientIds, null);
  const next = markIngredientsDirty(legacy, [milk], [{ ...milk, amount: 2 }]);
  assert.equal(next.dirtyIngredientIds, null);
});

test('rows edited during an upload stay pending', () => {
  const metadata = markIngredientsDirty(
    normalizeSyncMetadata(null),
    [milk],
    [{ ...milk, amount: 2 }]
  );
  const finished = finishIngredientSync(metadata, [], ['milk']);
  assert.equal(finished.ingredientsDirty, true);
  assert.deepEqual(finished.dirtyIngredientIds, ['milk']);
});
