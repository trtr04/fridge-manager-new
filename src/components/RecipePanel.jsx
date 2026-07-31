import React, { useEffect, useMemo, useState } from "react";
import { ChefHat } from "lucide-react";
import howToCookRecipes from "../data/howToCookRecipes.json";
import {
  DEFAULT_RECOMMENDATION_THRESHOLD,
  getInventoryKeys,
  getMatchLabel,
  recommendRecipes,
} from "../utils/recipeMatching";
import { useLanguage } from "../i18n/LanguageContext";
import {
  translateIngredientList,
  translateIngredientText,
  translateRecipeTitle
} from "../i18n/contentTranslations";

const CATEGORY_LABELS = {
  aquatic: ["水产", "Seafood"],
  breakfast: ["早餐", "Breakfast"],
  condiment: ["调味", "Seasonings"],
  dessert: ["甜品", "Dessert"],
  drink: ["饮品", "Drinks"],
  meat_dish: ["荤菜", "Meat dishes"],
  "semi-finished": ["半成品", "Prepared foods"],
  soup: ["汤粥", "Soups & congee"],
  staple: ["主食", "Staples"],
  vegetable_dish: ["素菜", "Vegetable dishes"],
};

const TAG_LABELS = {
  spicy: ["辣", "Spicy"],
  sweet: ["甜", "Sweet"],
  sour: ["酸", "Sour"],
  light: ["清淡", "Light"],
  savory: ["咸鲜", "Savory"],
  vegetableHeavy: ["蔬菜", "Vegetable-forward"],
  highProtein: ["高蛋白", "High protein"],
  lighter: ["轻负担", "Lighter"],
  highCalorie: ["高热量", "High calorie"],
  comfort: ["安慰感", "Comfort food"],
  refreshing: ["清爽", "Refreshing"],
  indulgent: ["满足感", "Indulgent"],
  quick: ["快手", "Quick"],
  normal: ["常规", "Standard"],
  slow: ["慢做", "Slow"],
};

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatTags(recipe, language) {
  return [
    ...(recipe.flavorTags || []),
    ...(recipe.nutritionTags || []),
    ...(recipe.moodTags || []),
    ...(recipe.speedTags || []),
  ]
    .map((tag) => {
      const labels = TAG_LABELS[tag];
      return labels ? labels[language === 'en' ? 1 : 0] : tag;
    })
    .slice(0, 5);
}

function RecipePanel({ ingredients, preferences }) {
  const { t, language, isEnglish } = useLanguage();
  const [sessionPrefs, setSessionPrefs] = useState({
    speed: "normal",
    people: 2,
    mood: "",
    period: false,
    showPlate: false,
    calories: false,
  });
  const [recipes, setRecipes] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [englishCatalog, setEnglishCatalog] = useState(null);

  useEffect(() => {
    if (!isEnglish || englishCatalog) return undefined;

    let isActive = true;
    import("../data/howToCookEnglish.json").then((module) => {
      if (isActive) setEnglishCatalog(module.default);
    });

    return () => {
      isActive = false;
    };
  }, [englishCatalog, isEnglish]);

  const inventoryKeys = useMemo(() => getInventoryKeys(ingredients), [ingredients]);
  const threshold = DEFAULT_RECOMMENDATION_THRESHOLD;

  const effectivePreferences = {
    ...(preferences || {}),
    speed:
      sessionPrefs.speed === "normal" && preferences?.quickMeals
        ? "quick"
        : sessionPrefs.speed,
    mood: sessionPrefs.mood,
    calories: sessionPrefs.calories || preferences?.considerNutrition,
    showPlate: sessionPrefs.showPlate,
  };

  const generateRecipes = () => {
    const recommended = recommendRecipes({
      recipes: howToCookRecipes,
      ingredients,
      preferences: effectivePreferences,
      threshold,
      limit: 20,
    });

    setRecipes(recommended);
    setHasGenerated(true);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <ChefHat className="text-green-600" />
        {t('今天吃什么', 'What should I cook?')}
      </h2>

      {recipes.length === 0 ? (
        <div>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('速度偏好', 'Cooking speed')}
              </label>
              <div className="flex gap-2">
                {[
                  { value: "quick", label: t("⏱ 快手", "⏱ Quick") },
                  { value: "normal", label: t("🍳 不限", "🍳 Any") },
                  { value: "slow", label: t("🥘 慢慢做", "🥘 Take it slow") },
                ].map((speed) => (
                  <button
                    key={speed.value}
                    onClick={() =>
                      setSessionPrefs({ ...sessionPrefs, speed: speed.value })
                    }
                    className={`flex-1 py-2 rounded transition ${
                      sessionPrefs.speed === speed.value
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    type="button"
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {t('几个人吃', 'Number of servings')}
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={sessionPrefs.people}
                onChange={(e) =>
                  setSessionPrefs({
                    ...sessionPrefs,
                    people: parseInt(e.target.value) || 1,
                  })
                }
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {t('心情', 'Mood')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    value: "stressed",
                    label: t("😤 压力大", "😤 Stressed"),
                    desc: t("推荐脆口", "Crisp & refreshing")
                  },
                  {
                    value: "sad",
                    label: t("😔 难过", "😔 Down"),
                    desc: t("推荐甜口", "Something sweet")
                  },
                  {
                    value: "happy",
                    label: t("😊 开心", "😊 Happy"),
                    desc: t("随意", "Anything goes")
                  },
                  {
                    value: "",
                    label: t("😐 普通", "😐 Neutral"),
                    desc: t("常规推荐", "Standard ranking")
                  },
                ].map((mood) => (
                  <button
                    key={mood.value}
                    onClick={() =>
                      setSessionPrefs({ ...sessionPrefs, mood: mood.value })
                    }
                    className={`p-2 rounded text-left text-sm transition ${
                      sessionPrefs.mood === mood.value
                        ? "bg-purple-100 border-2 border-purple-500"
                        : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                    }`}
                    type="button"
                  >
                    <div className="font-medium">{mood.label}</div>
                    <div className="text-xs text-gray-500">{mood.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sessionPrefs.showPlate}
                  onChange={(e) =>
                    setSessionPrefs({
                      ...sessionPrefs,
                      showPlate: e.target.checked,
                    })
                  }
                  className="w-4 h-4"
                />
                {t('显示餐盘理论', 'Use the healthy plate model')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sessionPrefs.calories}
                  onChange={(e) =>
                    setSessionPrefs({
                      ...sessionPrefs,
                      calories: e.target.checked,
                    })
                  }
                  className="w-4 h-4"
                />
                {t('关注卡路里', 'Consider calories')}
              </label>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3">
              {t(
                `当前库存可匹配 ${inventoryKeys.size} 种食材，推荐阈值 ${formatPercent(
                  threshold
                )}。排序会综合食材匹配、快过期食材、难度和当前偏好。`,
                `Your inventory contains ${inventoryKeys.size} matchable ingredient(s). The recommendation threshold is ${formatPercent(
                  threshold
                )}. Ranking combines ingredient match, expiring items, difficulty and preferences.`
              )}
              {preferences?.tastes?.length > 0 && (
                <>{t(' 已读取长期口味偏好。', ' Long-term flavor preferences are active.')}</>
              )}
              {' '}
              {t(
                '油、盐等基础调味料默认视为已有，不计入匹配率。',
                'Basic seasonings such as oil and salt are assumed available and excluded from the match percentage.'
              )}
            </div>
          </div>

          {hasGenerated && (
            <div className="mb-4 text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-lg p-3">
              {t(
                `没有找到达到 ${formatPercent(
                  threshold
                )} 匹配度的菜谱。请补录更多主料后重试。`,
                `No recipes reached the ${formatPercent(
                  threshold
                )} threshold. Add more core ingredients and try again.`
              )}
            </div>
          )}

          <button
            onClick={generateRecipes}
            disabled={!ingredients || ingredients.length === 0}
            className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            type="button"
          >
            {!ingredients || ingredients.length === 0
              ? t("请先添加食材", "Add ingredients first")
              : t("🎲 生成菜谱推荐", "🎲 Generate recommendations")}
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              {t(
                `为你推荐 ${recipes.length} 道菜`,
                `${recipes.length} recipe recommendation(s)`
              )}
            </div>
            <button
              onClick={() => {
                setRecipes([]);
                setHasGenerated(false);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 transition"
              type="button"
            >
              {t('重新生成', 'Start over')}
            </button>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {recipes.map((recipe, recipeIndex) => {
              const englishRecipe = isEnglish
                ? englishCatalog?.recipes?.[recipe.id]
                : null;
              const displayedItems =
                englishRecipe?.requiredItems?.length > 0
                  ? englishRecipe.requiredItems
                  : recipe.requiredItems;
              const displayedDescription = isEnglish
                ? englishRecipe?.description
                : recipe.description;
              const displayedSteps = isEnglish
                ? englishRecipe?.steps || []
                : recipe.steps;

              return (
                <div
                key={recipe.id}
                className="border-2 border-gray-200 rounded-lg p-4 hover:border-green-500 transition"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg mb-1 text-gray-900">
                      {englishRecipe?.title ||
                        translateRecipeTitle(
                          recipe.title,
                          CATEGORY_LABELS[recipe.category]?.[1],
                          recipeIndex,
                          language
                        )}
                    </h3>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-2">
                      <span>
                        {CATEGORY_LABELS[recipe.category]
                          ? CATEGORY_LABELS[recipe.category][
                              isEnglish ? 1 : 0
                            ]
                          : recipe.category}
                      </span>
                      {recipe.difficulty != null && (
                        <span>
                          {t('难度', 'Difficulty')} {recipe.difficulty}/5
                        </span>
                      )}
                      {recipe.calories != null && (
                        <span>
                          {recipe.calories} {t('大卡', 'kcal')}
                        </span>
                      )}
                      {recipe.estimatedTimeMinutes != null && (
                        <span>
                          {t('约', 'About')} {recipe.estimatedTimeMinutes}{' '}
                          {t('分钟', 'min')}
                        </span>
                      )}
                    </div>
                    <div className="bg-green-50 text-green-700 text-sm px-3 py-1 rounded-full inline-block">
                      {getMatchLabel(recipe.matchScore, language)} ·{' '}
                      {t('食材', 'Ingredients')}{" "}
                      {formatPercent(recipe.matchScore)} ·{' '}
                      {t('综合', 'Overall')}{" "}
                      {formatPercent(recipe.finalScore)}
                    </div>
                  </div>
                </div>

                {formatTags(recipe, language).length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formatTags(recipe, language).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {displayedDescription && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {displayedDescription}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  {displayedItems.map((item, idx) => {
                    const isOwned = recipe.ingredientKeys.some(
                      (key) =>
                        recipe.matchedIngredients.includes(key) &&
                        (item.includes(key) || key.includes(item))
                    );
                    return (
                      <span
                        key={`${item}-${idx}`}
                        className={`text-xs px-2 py-1 rounded ${
                          isEnglish && englishRecipe
                            ? "bg-gray-100 text-gray-700"
                            : isOwned
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-50 text-orange-700"
                        }`}
                      >
                        {isEnglish && englishRecipe
                          ? item
                          : translateIngredientText(item, language)}
                      </span>
                    );
                  })}
                </div>

                {(recipe.missingCoreIngredients.length > 0 ||
                  recipe.missingSupportingIngredients.length > 0) && (
                  <div className="space-y-1 mb-3">
                    {recipe.missingCoreIngredients.length > 0 && (
                      <p className="text-xs text-orange-700">
                        {t('还缺主料:', 'Missing core ingredients:')}{' '}
                        {translateIngredientList(
                          recipe.missingCoreIngredients,
                          language
                        ).join(", ")}
                      </p>
                    )}
                    {recipe.missingSupportingIngredients.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {t('还缺调味/工具:', 'Missing supporting items/tools:')}{" "}
                        {translateIngredientList(
                          recipe.missingSupportingIngredients,
                          language
                        ).join(", ")}
                      </p>
                    )}
                  </div>
                )}

                {displayedSteps.length > 0 && (
                  <div className="mb-3">
                    <div className="text-sm font-medium mb-2">
                      {t('步骤：', 'Steps:')}
                    </div>
                    <ol className="text-sm text-gray-600 space-y-1">
                      {displayedSteps.slice(0, 4).map((step, idx) => (
                        <li key={idx}>
                          {idx + 1}. {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {isEnglish && !englishCatalog && (
                  <p className="mb-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                    Loading the English recipe…
                  </p>
                )}

                {isEnglish && englishCatalog && !englishRecipe && (
                  <p className="mb-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                    This recipe was added after the available English
                    translation snapshot. Its recommendation data is still
                    available, but the full English instructions have not been
                    published by the source project.
                  </p>
                )}

                <div className="text-xs text-gray-400">
                  {t(
                    '数据来自 HowToCook · 当前仅按食材名匹配，暂不自动扣减库存',
                    'Data from HowToCook · Ingredient-name matching only · Inventory is not deducted automatically'
                  )}
                  {isEnglish && englishRecipe?.sourceUrl && (
                    <>
                      {' · '}
                      <a
                        href={englishRecipe.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-500 hover:text-blue-600"
                      >
                        English source
                      </a>
                    </>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default RecipePanel;
