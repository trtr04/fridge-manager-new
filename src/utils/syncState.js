export const EMPTY_SYNC_METADATA = Object.freeze({
  ingredientsDirty: false,
  preferencesDirty: false,
  deletedIngredientIds: [],
});

export function normalizeSyncMetadata(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ingredientsDirty: source.ingredientsDirty === true,
    preferencesDirty: source.preferencesDirty === true,
    deletedIngredientIds: Array.from(
      new Set(
        Array.isArray(source.deletedIngredientIds)
          ? source.deletedIngredientIds.filter(
              (id) => typeof id === 'string' && id.length > 0
            )
          : []
      )
    ),
  };
}

export function getRemovedIngredientIds(previous = [], next = []) {
  const nextIds = new Set(next.map((item) => item?.id).filter(Boolean));
  return previous
    .map((item) => item?.id)
    .filter((id) => id && !nextIds.has(id));
}

export function markIngredientsDirty(metadata, previous, next) {
  const current = normalizeSyncMetadata(metadata);
  const removedIds = getRemovedIngredientIds(previous, next);
  return {
    ...current,
    ingredientsDirty: true,
    deletedIngredientIds: Array.from(
      new Set([...current.deletedIngredientIds, ...removedIds])
    ),
  };
}

export function mergeIngredientSnapshots({
  cloudIngredients = [],
  localIngredients = [],
  deletedIngredientIds = [],
}) {
  const deleted = new Set(deletedIngredientIds);
  const merged = new Map();

  for (const item of cloudIngredients) {
    if (item?.id && !deleted.has(item.id)) merged.set(item.id, item);
  }
  // An unsynced local row is authoritative for the same id, while cloud-only
  // rows are retained so another browser's additions are never erased.
  for (const item of localIngredients) {
    if (item?.id && !deleted.has(item.id)) merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

export function finishIngredientSync(metadata, processedDeletedIds = []) {
  const current = normalizeSyncMetadata(metadata);
  const processed = new Set(processedDeletedIds);
  const remaining = current.deletedIngredientIds.filter(
    (id) => !processed.has(id)
  );
  return {
    ...current,
    ingredientsDirty: remaining.length > 0,
    deletedIngredientIds: remaining,
  };
}
