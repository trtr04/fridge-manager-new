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

const RESTRICTION_FAMILIES = {
  pork: {
    ingredient:
      /猪|五花肉|排骨|猪蹄|猪皮|猪油|猪肝|猪肚|猪耳|猪骨|肥肠|肘子|大肉|大排|排条|里脊肉|叉烧|肉松|腊肉|腊肠|香肠|火腿|培根|午餐肉|(?<![牛羊鸡鸭鱼虾])肉末|(?<![牛羊鸡鸭鱼虾])肉馅|瘦肉/,
    title:
      /猪|五花肉|排骨|猪蹄|肥肠|肘子|大排|排条|里脊肉|叉烧|腊肉|腊肠|香肠|火腿|培根|红烧肉|回锅肉|(?<![牛羊鸡鸭鱼虾])肉末|(?<![牛羊鸡鸭鱼虾])肉馅/,
  },
  beef: {
    ingredient:
      /牛肉|肥牛|牛腩|牛排|牛柳|牛里脊|牛腱|牛筋|牛肚|牛百叶|牛杂|牛丸|免治牛|黄牛/,
    title:
      /牛肉|肥牛|牛腩|牛排|牛柳|牛里脊|牛腱|牛筋|牛肚|牛百叶|牛杂|牛丸|免治牛|黄牛/,
  },
  lamb: {
    ingredient: /羊肉|羊排|羊腿|羊蝎子|羊杂|羊肚|羊肉卷/,
    title: /羊肉|羊排|羊腿|羊蝎子|羊杂|羊肚/,
  },
  poultry: {
    ingredient:
      /鸡(?!蛋|精)|鸭肉|鸭腿|鸭翅|鸭胸|烤鸭|鹅肉|鹅腿|火鸡/,
    title:
      /鸡肉|鸡翅|鸡腿|鸡胸|鸡爪|鸡脚|鸡胗|鸡肝|童子鸡|乌鸡|口水鸡|烤鸡|炸鸡|鸭肉|鸭腿|鸭翅|鸭胸|烤鸭|鹅肉|鹅腿|火鸡/,
  },
  seafood: {
    ingredient:
      /鱼|虾|蟹|海参|生蚝|牡蛎|蛏|蛤|贝|鳝|鱿鱼|章鱼|墨鱼|海蜇|鲍鱼|扇贝|螺|三文鱼|金枪鱼|鳕|带鱼|鲫|鲤|鳊|鲈|鱼露|蚝油/,
    title:
      /鱼(?!香)|虾|蟹|海参|生蚝|牡蛎|蛏|蛤|鳝|鱿鱼|章鱼|墨鱼|海蜇|鲍鱼|扇贝|三文鱼|金枪鱼|鳕|带鱼|鲫|鲤|鳊|鲈/,
  },
  egg: {
    ingredient: /鸡蛋|鸭蛋|鹅蛋|鹌鹑蛋|蛋黄|蛋白|蛋清|蛋液|蛋黄酱/,
    title: /鸡蛋|鸭蛋|鹅蛋|鹌鹑蛋|蛋黄|蛋白|蛋清/,
  },
  dairy: {
    ingredient: /牛奶|鲜奶|奶粉|奶油|炼乳|黄油|芝士|奶酪|乳酪|酸奶|乳清/,
    title: /牛奶|鲜奶|奶粉|奶油|炼乳|芝士|奶酪|乳酪|酸奶/,
  },
  peanut: {
    ingredient: /花生|花生酱|花生油|落花生/,
    title: /花生|落花生/,
  },
  shrimp: { ingredient: /虾/, title: /虾/ },
  crab: { ingredient: /蟹/, title: /蟹/ },
};

const DIET_RESTRICTION_FAMILIES = {
  vegetarian: ["pork", "beef", "lamb", "poultry", "seafood"],
  noPork: ["pork"],
  noBeef: ["beef"],
};

const MANUAL_RESTRICTION_FAMILIES = new Map([
  ["猪肉", "pork"],
  ["牛肉", "beef"],
  ["羊肉", "lamb"],
  ["鸡蛋", "egg"],
  ["牛奶", "dairy"],
  ["花生", "peanut"],
  ["虾", "shrimp"],
  ["蟹", "crab"],
]);

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

function getRecipeRestrictionText(recipe) {
  return {
    ingredients: [
      ...(recipe.ingredientKeys || []),
      ...(recipe.requiredItems || []),
    ].join("|"),
    title: String(recipe.title || ""),
  };
}

function matchesRestrictionFamily(recipeText, familyName) {
  const family = RESTRICTION_FAMILIES[familyName];
  if (!family) return false;
  return (
    family.ingredient.test(recipeText.ingredients) ||
    family.title.test(recipeText.title)
  );
}

export function violatesRestrictions(recipe, preferences = {}) {
  const recipeText = getRecipeRestrictionText(recipe);
  const dietFamilies = (preferences.dietType || []).flatMap(
    (type) => DIET_RESTRICTION_FAMILIES[type] || []
  );

  if (
    Array.from(new Set(dietFamilies)).some((family) =>
      matchesRestrictionFamily(recipeText, family)
    )
  ) {
    return true;
  }

  const manualBlocks = Array.from(
    new Set([
      ...(preferences.allergens || []),
      ...(preferences.restrictions || []),
    ])
  );

  return manualBlocks.some((item) => {
    const normalizedBlocks = explodeIngredientKeys(item);
    return normalizedBlocks.some((blocked) => {
      const familyName = MANUAL_RESTRICTION_FAMILIES.get(blocked);
      if (familyName) {
        return matchesRestrictionFamily(recipeText, familyName);
      }
      return (
        recipeText.ingredients.includes(blocked) ||
        recipeText.title.includes(blocked)
      );
    });
  });
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
