// Pure inventory rules shared by the fridge panels, the move dialog and the
// ingredient picker. Every function returns a new list and never mutates.
//
// A "batch" is every row with the same name, storage area, unit and expiry
// date. Rows in one batch are shown as a single card.

import {
  NON_EXPIRING_DAYS,
  getDaysLeft,
  getExpiresAt,
  getTodayDate,
  isNonExpiringIngredient,
} from './dateUtils.js';
import { createIngredientId } from './ingredientIds.js';

export const STORAGE_AREAS = ['fridge', 'freezer', 'pantry', 'condiment'];
export const DEFAULT_SHELF_LIFE = 7;
// Days a thawed item keeps in the fridge.
export const THAWED_SHELF_LIFE = 2;
export const DEFAULT_UNIT = '个';

export function normStorage(storage) {
  if (!storage) return 'fridge';
  if (storage === 'room') return 'pantry';
  return storage;
}

export function isStorageArea(value) {
  return STORAGE_AREAS.includes(value);
}

export function normalizeIngredient(item) {
  const storage = normStorage(item?.storage);
  let shelfLife = Number(item?.shelfLife ?? item?.shelf_life);
  if (!Number.isFinite(shelfLife) || shelfLife < 0) {
    shelfLife = DEFAULT_SHELF_LIFE;
  }
  // Older versions stored 9999 when an item went into the freezer and kept it
  // when the item left, so pantry items never expired. Outside the freezer
  // that value is meaningless; fall back to the default shelf life.
  if (storage !== 'freezer' && shelfLife >= NON_EXPIRING_DAYS) {
    shelfLife = DEFAULT_SHELF_LIFE;
  }

  return {
    ...item,
    storage,
    shelfLife,
    purchaseDate: item?.purchaseDate ?? item?.purchase_date ?? '',
    unit: item?.unit || DEFAULT_UNIT,
    amount: Number(item?.amount) || 0,
  };
}

export function getBatchExpiresAt(item) {
  const n = normalizeIngredient(item);
  return getExpiresAt(n.purchaseDate, n.shelfLife, n.storage, n.name);
}

export function getBatchKey(item) {
  const n = normalizeIngredient(item);
  const base = `${n.name}__${n.storage}__${n.unit}`;
  return isNonExpiringIngredient(n.storage, n.name)
    ? base
    : `${base}__${getBatchExpiresAt(n)}`;
}

function getItemDaysLeft(item, now) {
  const n = normalizeIngredient(item);
  return getDaysLeft(n.purchaseDate, n.shelfLife, n.storage, n.name, now);
}

/**
 * Removes up to `qty` from the rows matching `predicate`, earliest expiry
 * first. Rows that reach zero are deleted.
 */
function consumeMatching(list, predicate, qty, now) {
  const order = (list || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => predicate(item) && Number(item.amount) > 0)
    .sort(
      (a, b) =>
        getItemDaysLeft(a.item, now) - getItemDaysLeft(b.item, now) ||
        a.index - b.index
    );

  const updates = new Map();
  const taken = [];
  let need = Math.max(0, Number(qty) || 0);

  for (const { item, index } of order) {
    if (need <= 0) break;
    const current = Number(item.amount) || 0;
    const take = Math.min(current, need);
    updates.set(index, current - take);
    taken.push({ item, qty: take });
    need -= take;
  }

  const next = [];
  (list || []).forEach((item, index) => {
    if (!updates.has(index)) {
      next.push(item);
      return;
    }
    const left = updates.get(index);
    if (left > 0) next.push({ ...item, amount: left });
  });

  return {
    list: next,
    removedQty: taken.reduce((sum, entry) => sum + entry.qty, 0),
    taken,
  };
}

export function consumeFromBatch(list, batchKey, qty, now = new Date()) {
  return consumeMatching(
    list,
    (item) => getBatchKey(item) === batchKey,
    qty,
    now
  );
}

/** Removes `qty` of an ingredient by name, using the earliest expiry first. */
export function consumeByName(list, name, qty, now = new Date()) {
  return consumeMatching(list, (item) => item.name === name, qty, now);
}

/**
 * Adds stock bought on `purchaseDate` (default today). A row bought the same
 * day with the same name, storage, unit and shelf life is topped up; anything
 * else becomes a new purchase batch so older stock keeps its own expiry.
 */
export function addStock(list, stock, now = new Date()) {
  const purchaseDate = stock.purchaseDate || getTodayDate(now);
  const incoming = normalizeIngredient({ ...stock, purchaseDate });
  const amount = Number(stock.amount) || 0;
  if (!incoming.name || amount <= 0) return list || [];

  const index = (list || []).findIndex((item) => {
    const n = normalizeIngredient(item);
    return (
      n.name === incoming.name &&
      n.storage === incoming.storage &&
      n.unit === incoming.unit &&
      n.shelfLife === incoming.shelfLife &&
      n.purchaseDate === purchaseDate
    );
  });

  if (index >= 0) {
    const next = [...list];
    next[index] = {
      ...next[index],
      amount: (Number(next[index].amount) || 0) + amount,
    };
    return next;
  }

  const row = {
    id: createIngredientId(),
    name: incoming.name,
    amount,
    unit: incoming.unit,
    storage: incoming.storage,
    shelfLife: incoming.shelfLife,
    purchaseDate,
  };
  if (stock.category) row.category = stock.category;
  return [...(list || []), row];
}

/**
 * Moves `qty` from one batch to another storage area.
 *
 * - Into the freezer: purchase date and shelf life are kept (the freezer
 *   pauses the countdown, it does not change the item's own shelf life).
 * - Out of the freezer into the fridge: counted as thawed, so the countdown
 *   restarts today with THAWED_SHELF_LIFE days.
 * - Out of the freezer into the pantry or seasonings: the countdown restarts
 *   today with the item's own shelf life.
 * - Anything else keeps its purchase date and shelf life.
 */
export function moveBetweenStorages(
  list,
  { batchKey, toStorage, qty },
  now = new Date()
) {
  if (!isStorageArea(toStorage)) return { list, movedQty: 0 };

  const { list: remaining, removedQty, taken } = consumeFromBatch(
    list,
    batchKey,
    qty,
    now
  );
  if (removedQty <= 0) return { list, movedQty: 0 };

  const source = normalizeIngredient(taken[0].item);
  if (source.storage === toStorage) return { list, movedQty: 0 };

  const today = getTodayDate(now);
  // Frozen rows written by older versions may still carry the 9999 sentinel.
  const ownShelfLife =
    source.shelfLife >= NON_EXPIRING_DAYS
      ? DEFAULT_SHELF_LIFE
      : source.shelfLife;
  let purchaseDate = source.purchaseDate || today;
  let shelfLife = ownShelfLife;

  if (source.storage === 'freezer') {
    purchaseDate = today;
    shelfLife =
      toStorage === 'fridge'
        ? Math.min(THAWED_SHELF_LIFE, ownShelfLife)
        : ownShelfLife;
  }

  const moved = {
    id: createIngredientId(),
    name: source.name,
    amount: removedQty,
    unit: source.unit,
    storage: toStorage,
    shelfLife,
    purchaseDate,
  };
  if (source.category) moved.category = source.category;

  return { list: [...remaining, moved], movedQty: removedQty };
}
