// Sync bookkeeping for signed-in users.
//
// The app only uploads rows that actually changed since the last successful
// load or sync. Uploading the whole list on every edit used to bring back rows
// that another device had deleted in the meantime.
//
// Persisted metadata (localStorage, per user):
// - deletedIngredientIds: rows removed locally whose cloud delete is pending.
// - dirtyIngredientIds: rows changed locally whose upload is pending. `null`
//   means "unknown" (metadata from an older app version); every local row is
//   then treated as changed, which is the old behaviour.

export const EMPTY_SYNC_METADATA = Object.freeze({
  ingredientsDirty: false,
  preferencesDirty: false,
  deletedIngredientIds: [],
  dirtyIngredientIds: [],
});

const uniqueIds = (values) =>
  Array.from(
    new Set(
      (values || []).filter((id) => typeof id === 'string' && id.length > 0)
    )
  );

export function normalizeSyncMetadata(value) {
  const source = value && typeof value === 'object' ? value : {};
  const ingredientsDirty = source.ingredientsDirty === true;
  return {
    ingredientsDirty,
    preferencesDirty: source.preferencesDirty === true,
    deletedIngredientIds: uniqueIds(
      Array.isArray(source.deletedIngredientIds)
        ? source.deletedIngredientIds
        : []
    ),
    dirtyIngredientIds: Array.isArray(source.dirtyIngredientIds)
      ? uniqueIds(source.dirtyIngredientIds)
      : ingredientsDirty
      ? null
      : [],
  };
}

/** The fields stored in the cloud, normalised the same way as mapToDB. */
export function ingredientFingerprint(item) {
  return JSON.stringify([
    item?.name ?? '',
    Number(item?.amount) || 0,
    item?.unit ?? '',
    item?.storage === 'room' ? 'pantry' : item?.storage ?? '',
    item?.category || 'other',
    Number(item?.shelfLife ?? item?.shelf_life ?? 7),
    item?.purchaseDate ?? item?.purchase_date ?? '',
  ]);
}

export function buildFingerprintMap(items = []) {
  return new Map(
    items
      .filter((item) => item?.id)
      .map((item) => [item.id, ingredientFingerprint(item)])
  );
}

/** Rows whose content differs from the last version known to be in the cloud. */
export function getRowsToUpload(items = [], syncedFingerprints = new Map()) {
  return items.filter(
    (item) =>
      item?.id &&
      syncedFingerprints.get(item.id) !== ingredientFingerprint(item)
  );
}

export function getRemovedIngredientIds(previous = [], next = []) {
  const nextIds = new Set(next.map((item) => item?.id).filter(Boolean));
  return previous
    .map((item) => item?.id)
    .filter((id) => id && !nextIds.has(id));
}

export function getChangedIngredientIds(previous = [], next = []) {
  const before = buildFingerprintMap(previous);
  return next
    .filter(
      (item) => item?.id && before.get(item.id) !== ingredientFingerprint(item)
    )
    .map((item) => item.id);
}

export function markIngredientsDirty(metadata, previous, next) {
  const current = normalizeSyncMetadata(metadata);
  const removedIds = getRemovedIngredientIds(previous, next);
  const changedIds = getChangedIngredientIds(previous, next);
  const removed = new Set(removedIds);
  const present = new Set((next || []).map((item) => item?.id));

  const deletedIngredientIds = uniqueIds([
    ...current.deletedIngredientIds.filter((id) => !present.has(id)),
    ...removedIds,
  ]);
  const dirtyIngredientIds =
    current.dirtyIngredientIds === null
      ? null
      : uniqueIds([...current.dirtyIngredientIds, ...changedIds]).filter(
          (id) => !removed.has(id)
        );

  return {
    ...current,
    ingredientsDirty:
      current.ingredientsDirty ||
      removedIds.length > 0 ||
      changedIds.length > 0,
    deletedIngredientIds,
    dirtyIngredientIds,
  };
}

/**
 * Combines the cloud rows with a local cache that has unsynced changes.
 * - Pending local deletions win.
 * - Locally changed rows win over the cloud version.
 * - Unchanged local rows that are missing from the cloud were deleted on
 *   another device, so they are dropped.
 * - Cloud-only rows are kept (another device added them).
 */
export function mergeIngredientSnapshots({
  cloudIngredients = [],
  localIngredients = [],
  deletedIngredientIds = [],
  dirtyIngredientIds = null,
}) {
  const deleted = new Set(deletedIngredientIds);
  const dirty = dirtyIngredientIds === null ? null : new Set(dirtyIngredientIds);
  const merged = new Map();

  for (const item of cloudIngredients) {
    if (item?.id && !deleted.has(item.id)) merged.set(item.id, item);
  }
  for (const item of localIngredients) {
    if (!item?.id || deleted.has(item.id)) continue;
    if (dirty === null || dirty.has(item.id)) merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

/**
 * Records a finished ingredient sync. `remainingDirtyIds` are the rows that
 * still differ from the cloud after the upload (edited while it ran).
 */
export function finishIngredientSync(
  metadata,
  processedDeletedIds = [],
  remainingDirtyIds = []
) {
  const current = normalizeSyncMetadata(metadata);
  const processed = new Set(processedDeletedIds);
  const deletedIngredientIds = current.deletedIngredientIds.filter(
    (id) => !processed.has(id)
  );
  const dirtyIngredientIds = uniqueIds(remainingDirtyIds);
  return {
    ...current,
    ingredientsDirty:
      deletedIngredientIds.length > 0 || dirtyIngredientIds.length > 0,
    deletedIngredientIds,
    dirtyIngredientIds,
  };
}
