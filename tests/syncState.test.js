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
