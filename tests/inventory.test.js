import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToDate,
  getDaysLeft,
  getDaysSincePurchase,
  getExpiresAt,
  getTodayDate,
} from '../src/utils/dateUtils.js';
import {
  addStock,
  consumeByName,
  consumeFromBatch,
  getBatchKey,
  moveBetweenStorages,
  normalizeIngredient,
} from '../src/utils/inventory.js';
import { validateIngredientDraft } from '../src/utils/ingredientValidation.js';

// 6pm local on 12 Nov 2026: already 13 Nov in UTC for every US time zone.
const EVENING = new Date(2026, 10, 12, 18, 0, 0);
const TODAY = '2026-11-12';

const row = (overrides) => ({
  id: crypto.randomUUID(),
  name: '牛奶',
  amount: 1,
  unit: '盒',
  storage: 'fridge',
  shelfLife: 7,
  purchaseDate: TODAY,
  ...overrides,
});

test('dates use the local calendar day, not UTC', () => {
  assert.equal(getTodayDate(EVENING), TODAY);
  assert.equal(getDaysSincePurchase(TODAY, EVENING), 0);
  assert.equal(getDaysSincePurchase('2026-11-11', EVENING), 1);
  assert.equal(getDaysLeft(TODAY, 7, 'fridge', '牛奶', EVENING), 7);
  assert.equal(getDaysLeft('2026-11-05', 7, 'fridge', '牛奶', EVENING), 0);
  assert.equal(getDaysLeft('2026-11-01', 7, 'fridge', '牛奶', EVENING), -4);
  assert.equal(getExpiresAt(TODAY, 7, 'fridge', '牛奶'), '2026-11-19');
  assert.equal(getExpiresAt(TODAY, 7, 'freezer', '牛奶'), '');
});

test('date arithmetic crosses month, year and DST boundaries', () => {
  assert.equal(addDaysToDate('2026-10-30', 3), '2026-11-02');
  assert.equal(addDaysToDate('2026-12-30', 3), '2027-01-02');
  // US daylight saving ends on 1 Nov 2026.
  assert.equal(
    getDaysLeft('2026-10-31', 3, 'fridge', '', new Date(2026, 10, 3, 9)),
    0
  );
});

test('validation rejects impossible purchase dates', () => {
  const draft = {
    name: '牛奶',
    amount: 1,
    unit: '盒',
    storage: 'fridge',
    category: '乳制品',
    shelfLife: 7,
  };
  assert.ok(validateIngredientDraft({ ...draft, purchaseDate: TODAY }).ingredient);
  assert.ok(validateIngredientDraft({ ...draft, purchaseDate: '2026-02-31' }).error);
});

test('legacy 9999 shelf life outside the freezer falls back to the default', () => {
  const item = normalizeIngredient(row({ storage: 'pantry', shelfLife: 9999 }));
  assert.equal(item.shelfLife, 7);
  assert.equal(
    normalizeIngredient(row({ storage: 'freezer', shelfLife: 9999 })).shelfLife,
    9999
  );
});

test('freezer to pantry restarts the countdown instead of 9999 days', () => {
  const frozen = row({
    name: '面包',
    unit: '个',
    amount: 3,
    storage: 'freezer',
    shelfLife: 5,
    purchaseDate: '2026-10-01',
  });
  const { list, movedQty } = moveBetweenStorages(
    [frozen],
    { batchKey: getBatchKey(frozen), toStorage: 'pantry', qty: 2 },
    EVENING
  );
  assert.equal(movedQty, 2);
  const moved = list.find((item) => item.storage === 'pantry');
  assert.equal(moved.amount, 2);
  assert.equal(moved.shelfLife, 5);
  assert.equal(moved.purchaseDate, TODAY);
  assert.equal(list.find((item) => item.storage === 'freezer').amount, 1);
});

test('legacy frozen 9999 rows get the default shelf life when they leave', () => {
  const frozen = row({ storage: 'freezer', shelfLife: 9999 });
  const { list } = moveBetweenStorages(
    [frozen],
    { batchKey: getBatchKey(frozen), toStorage: 'condiment', qty: 1 },
    EVENING
  );
  assert.equal(list[0].shelfLife, 7);
});

test('freezer to fridge counts as thawed', () => {
  const frozen = row({ name: '鸡胸肉', storage: 'freezer', shelfLife: 3 });
  const { list } = moveBetweenStorages(
    [frozen],
    { batchKey: getBatchKey(frozen), toStorage: 'fridge', qty: 1 },
    EVENING
  );
  assert.equal(list[0].shelfLife, 2);
  assert.equal(list[0].purchaseDate, TODAY);
});

test('fridge to freezer keeps shelf life and purchase date, and category', () => {
  const fresh = row({ purchaseDate: '2026-11-10', category: '乳制品' });
  const { list } = moveBetweenStorages(
    [fresh],
    { batchKey: getBatchKey(fresh), toStorage: 'freezer', qty: 1 },
    EVENING
  );
  assert.equal(list[0].storage, 'freezer');
  assert.equal(list[0].shelfLife, 7);
  assert.equal(list[0].purchaseDate, '2026-11-10');
  assert.equal(list[0].category, '乳制品');
});

test('adding stock creates a new batch unless it was bought the same day', () => {
  const old = row({ purchaseDate: '2026-11-01' });
  let list = addStock([old], { name: '牛奶', amount: 1, unit: '盒', storage: 'fridge', shelfLife: 7 }, EVENING);
  assert.equal(list.length, 2);
  assert.equal(list[0].purchaseDate, '2026-11-01');
  assert.equal(list[1].purchaseDate, TODAY);

  list = addStock(list, { name: '牛奶', amount: 1, unit: '盒', storage: 'fridge', shelfLife: 7 }, EVENING);
  assert.equal(list.length, 2);
  assert.equal(list[1].amount, 2);
});

test('consuming by name uses the earliest expiry first', () => {
  const later = row({ id: 'a', purchaseDate: TODAY, amount: 2 });
  const sooner = row({ id: 'b', purchaseDate: '2026-11-08', amount: 1 });
  const { list } = consumeByName([later, sooner], '牛奶', 2, EVENING);
  assert.deepEqual(
    list.map((item) => [item.id, item.amount]),
    [['a', 1]]
  );
});

test('consuming a batch only touches that batch', () => {
  const fridge = row({ id: 'f', amount: 2 });
  const freezer = row({ id: 'z', storage: 'freezer', amount: 2 });
  const { list, removedQty } = consumeFromBatch(
    [fridge, freezer],
    getBatchKey(fridge),
    5,
    EVENING
  );
  assert.equal(removedQty, 2);
  assert.deepEqual(list.map((item) => item.id), ['z']);
});
