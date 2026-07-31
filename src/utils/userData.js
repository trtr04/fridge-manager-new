export function normalizePreferences(value) {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};

  return {
    tastes: Array.isArray(source.tastes) ? source.tastes : [],
    quickMeals: source.quickMeals === true,
    allergens: Array.isArray(source.allergens) ? source.allergens : [],
    dietType: Array.isArray(source.dietType) ? source.dietType : [],
    restrictions: Array.isArray(source.restrictions)
      ? source.restrictions
      : [],
    periodRestrictions: Array.isArray(source.periodRestrictions)
      ? source.periodRestrictions
      : [],
    considerNutrition: source.considerNutrition === true
  };
}

export function hasMeaningfulPreferences(value) {
  const normalized = normalizePreferences(value);
  return (
    normalized.tastes.length > 0 ||
    normalized.quickMeals ||
    normalized.allergens.length > 0 ||
    normalized.dietType.length > 0 ||
    normalized.restrictions.length > 0 ||
    normalized.periodRestrictions.length > 0 ||
    normalized.considerNutrition
  );
}

export function buildGuestImportCandidate({
  userId,
  cloudIngredients,
  cloudPreferences,
  guestIngredients,
  guestPreferences
}) {
  const ingredients =
    cloudIngredients.length === 0 && guestIngredients.length > 0
      ? guestIngredients
      : null;
  const preferences =
    !hasMeaningfulPreferences(cloudPreferences) &&
    hasMeaningfulPreferences(guestPreferences)
      ? normalizePreferences(guestPreferences)
      : null;

  if (!ingredients && !preferences) return null;
  return { userId, ingredients, preferences };
}
