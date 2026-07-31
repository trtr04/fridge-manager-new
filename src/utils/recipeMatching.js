import { explodeIngredientKeys } from "./ingredientNormalize.js";
import { getDaysLeft } from "./dateUtils.js";

export const DEFAULT_RECOMMENDATION_THRESHOLD = 0.5;

export const DEFAULT_PANTRY_KEYS = new Set([
  "油",
  "盐",
  "糖",
  "醋",
  "生抽",
  "老抽",
  "蚝油",
  "黄酒",
  "料酒",
  "香油",
  "淀粉",
  "水",
  "味素",
  "胡椒粉",
  "白胡椒",
  "黑胡椒",
  "花椒",
  "八角",
  "桂皮",
  "香叶",
  "葱",
  "姜",
  "蒜",
]);

const SUPPORTING_KEYS = new Set(DEFAULT_PANTRY_KEYS);

const TOOL_KEYS = new Set([
  "锅",
  "炒锅",
  "汤锅",
  "蒸锅",
  "电饭煲",
  "空气炸锅",
  "烤箱",
  "微波炉",
  "料理机",
  "搅拌机",
  "刀",
  "砧板",
  "碗",
]);

const DIET_RESTRICTIONS = {
  vegetarian: [
    "猪肉",
    "牛肉",
    "羊肉",
    "鸡肉",
    "鸭",
    "鱼",
    "虾",
    "蟹",
    "排骨",
    "五花肉",
    "肥牛",
    "牛腩",
    "鸡翅",
    "鸡腿",
    "肉末",
  ],
  noPork: ["猪肉", "五花肉", "排骨", "猪蹄", "猪皮", "肉末"],
  noBeef: ["牛肉", "肥牛", "牛腩", "牛排"],
};

const DIET_BOOSTS = {
  highProtein: "highProtein",
  lighter: "lighter",
};

function isSupportingKey(key) {
  return (
    SUPPORTING_KEYS.has(key) ||
    TOOL_KEYS.has(key) ||
    /锅|锅具|烤箱|微波炉|空气炸锅|电饭煲|刀|砧板|模具|锡纸/.test(key)
  );
}

export function isDefaultPantryKey(key) {
  return DEFAULT_PANTRY_KEYS.has(key);
}

function getBlockedKeys(preferences = {}) {
  const manualBlocks = [
    ...(preferences.allergens || []),
    ...(preferences.restrictions || []),
  ].flatMap((item) => explodeIngredientKeys(item));
  const dietBlocks = (preferences.dietType || []).flatMap(
    (type) => DIET_RESTRICTIONS[type] || []
  );
  return Array.from(new Set([...manualBlocks, ...dietBlocks]));
}

function violatesRestrictions(recipe, preferences = {}) {
  const blockedKeys = getBlockedKeys(preferences);
  if (blockedKeys.length === 0) return false;
  const recipeKeys = recipe.ingredientKeys || [];
  return blockedKeys.some((blocked) =>
    recipeKeys.some((key) => key.includes(blocked) || blocked.includes(key))
  );
}

export function getInventoryKeys(ingredients) {
  return new Set(
    (ingredients || [])
      .filter((item) => Number(item.amount || 0) > 0)
      .flatMap((item) => explodeIngredientKeys(item.name))
      .filter(Boolean)
  );
}

export function scoreRecipe(recipe, inventoryKeys) {
  const required = Array.from(new Set(recipe.ingredientKeys || []));
  const assumedIngredients = required.filter(isDefaultPantryKey);
  const scoredIngredients = required.filter(
    (key) => !isDefaultPantryKey(key)
  );
  const matchedIngredients = required.filter(
    (key) => inventoryKeys.has(key) || isDefaultPantryKey(key)
  );
  const missingIngredients = scoredIngredients.filter(
    (key) => !inventoryKeys.has(key)
  );
  const coreIngredients = scoredIngredients.filter(
    (key) => !isSupportingKey(key)
  );
  const supportingIngredients = scoredIngredients.filter(isSupportingKey);
  const missingCoreIngredients = coreIngredients.filter(
    (key) => !inventoryKeys.has(key)
  );
  const missingSupportingIngredients = supportingIngredients.filter(
    (key) => !inventoryKeys.has(key)
  );
  const coreMatchScore =
    coreIngredients.length === 0
      ? null
      : (coreIngredients.length - missingCoreIngredients.length) /
        coreIngredients.length;
  const supportingMatchScore =
    supportingIngredients.length === 0
      ? null
      : (supportingIngredients.length - missingSupportingIngredients.length) /
        supportingIngredients.length;
  const matchScore =
    coreMatchScore == null && supportingMatchScore == null
      ? 1
      : coreMatchScore == null
      ? supportingMatchScore
      : supportingMatchScore == null
      ? coreMatchScore
      : coreMatchScore * 0.7 + supportingMatchScore * 0.3;

  return {
    ...recipe,
    matchScore,
    coreMatchScore,
    supportingMatchScore,
    coreIngredients,
    supportingIngredients,
    assumedIngredients,
    matchedIngredients,
    missingIngredients,
    missingCoreIngredients,
    missingSupportingIngredients,
  };
}

function getUrgencyScore(recipe, expiringKeys) {
  const coreHits = (recipe.coreIngredients || []).filter((key) =>
    expiringKeys.has(key)
  ).length;
  const supportingHits = (recipe.supportingIngredients || []).filter((key) =>
    expiringKeys.has(key)
  ).length;
  return coreHits + supportingHits * 0.25;
}

function normalizeUrgencyScore(recipe) {
  const denominator = Math.max(1, (recipe.coreIngredients || []).length);
  return Math.min(1, (recipe.urgencyScore || 0) / denominator);
}

function getDifficultyScore(recipe) {
  if (recipe.difficulty == null) return 0.5;
  return Math.max(0, Math.min(1, (6 - recipe.difficulty) / 5));
}

function includesAny(values, targets) {
  return targets.some((target) => (values || []).includes(target));
}

function getPreferenceScore(recipe, preferences = {}) {
  const scores = [];

  for (const taste of preferences.tastes || []) {
    scores.push((recipe.flavorTags || []).includes(taste) ? 1 : 0.45);
  }

  if (preferences.quickMeals) {
    scores.push((recipe.speedTags || []).includes("quick") ? 1 : 0.35);
  }

  for (const dietType of preferences.dietType || []) {
    const tag = DIET_BOOSTS[dietType];
    if (tag) scores.push((recipe.nutritionTags || []).includes(tag) ? 1 : 0.45);
  }

  if (preferences.speed === "quick") {
    scores.push((recipe.speedTags || []).includes("quick") ? 1 : 0.25);
  } else if (preferences.speed === "slow") {
    scores.push((recipe.speedTags || []).includes("slow") ? 1 : 0.45);
  }

  if (preferences.mood === "stressed") {
    scores.push(includesAny(recipe.moodTags, ["refreshing"]) ? 1 : 0.45);
  } else if (preferences.mood === "sad") {
    scores.push(
      includesAny(recipe.flavorTags, ["sweet"]) ||
        includesAny(recipe.moodTags, ["comfort"])
        ? 1
        : 0.45
    );
  } else if (preferences.mood === "happy") {
    scores.push(0.75);
  }

  if (preferences.calories) {
    if ((recipe.nutritionTags || []).includes("lighter")) scores.push(1);
    else if ((recipe.nutritionTags || []).includes("highCalorie")) scores.push(0.2);
    else scores.push(0.6);
  }

  if (preferences.considerNutrition) {
    const hasProtein = (recipe.nutritionTags || []).includes("highProtein");
    const hasVegetables = (recipe.nutritionTags || []).includes("vegetableHeavy");
    const isLighter = (recipe.nutritionTags || []).includes("lighter");
    const isHighCalorie = (recipe.nutritionTags || []).includes("highCalorie");
    scores.push(
      isHighCalorie ? 0.25 : isLighter || (hasProtein && hasVegetables) ? 1 : 0.6
    );
  }

  if (preferences.showPlate) {
    const hasProtein = (recipe.nutritionTags || []).includes("highProtein");
    const hasVegetables = (recipe.nutritionTags || []).includes("vegetableHeavy");
    scores.push(hasProtein && hasVegetables ? 1 : hasProtein || hasVegetables ? 0.65 : 0.35);
  }

  if (scores.length === 0) return 0.5;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function getFinalScore(recipe, preferences) {
  const urgencyScore = normalizeUrgencyScore(recipe);
  const difficultyScore = getDifficultyScore(recipe);
  const preferenceScore = getPreferenceScore(recipe, preferences);

  return {
    finalScore:
      recipe.matchScore * 0.6 +
      urgencyScore * 0.2 +
      difficultyScore * 0.1 +
      preferenceScore * 0.1,
    urgencyScoreNormalized: urgencyScore,
    difficultyScore,
    preferenceScore,
  };
}

export function recommendRecipes({
  recipes,
  ingredients,
  preferences,
  threshold = DEFAULT_RECOMMENDATION_THRESHOLD,
  limit = 20,
}) {
  const inventoryKeys = getInventoryKeys(ingredients);
  const expiringKeys = new Set(
    (ingredients || [])
      .filter(
        (item) =>
          getDaysLeft(item.purchaseDate, item.shelfLife, item.storage, item.name) <=
          3
      )
      .flatMap((item) => explodeIngredientKeys(item.name))
      .filter(Boolean)
  );

  return (recipes || [])
    .filter((recipe) => !violatesRestrictions(recipe, preferences))
    .map((recipe) => {
      const scored = scoreRecipe(recipe, inventoryKeys);
      const withUrgency = {
        ...scored,
        urgencyScore: getUrgencyScore(scored, expiringKeys),
      };
      const finalScores = getFinalScore(withUrgency, preferences);
      return {
        ...withUrgency,
        ...finalScores,
      };
    })
    .filter((recipe) => recipe.matchScore >= threshold)
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      if (b.urgencyScore !== a.urgencyScore) {
        return b.urgencyScore - a.urgencyScore;
      }
      if (a.missingCoreIngredients.length !== b.missingCoreIngredients.length) {
        return a.missingCoreIngredients.length - b.missingCoreIngredients.length;
      }
      return (a.difficulty || 99) - (b.difficulty || 99);
    })
    .slice(0, limit);
}

export function getMatchLabel(matchScore, language = 'zh') {
  if (language === 'en') {
    if (matchScore >= 0.9) return 'Strong match';
    if (matchScore >= 0.75) return 'Good match';
    return 'Worth trying';
  }
  if (matchScore >= 0.9) return "强匹配";
  if (matchScore >= 0.75) return "良好匹配";
  return "可尝试";
}
