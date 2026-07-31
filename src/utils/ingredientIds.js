const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isIngredientId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function createIngredientId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("This browser does not support secure UUID generation.");
  }
  return globalThis.crypto.randomUUID();
}

export function ensureIngredientIds(items = []) {
  return items.map((item) =>
    isIngredientId(item?.id) ? item : { ...item, id: createIngredientId() }
  );
}
