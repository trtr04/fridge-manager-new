import React from "react";
import { useLanguage } from "../i18n/LanguageContext";

const TASTE_OPTIONS = [
  { value: "spicy", zh: "麻辣", en: "Spicy" },
  { value: "savory", zh: "咸鲜", en: "Savory" },
  { value: "sweet", zh: "甜口", en: "Sweet" },
  { value: "sour", zh: "酸爽", en: "Sour" },
  { value: "light", zh: "清淡", en: "Light" },
];

const DIET_OPTIONS = [
  { value: "vegetarian", zh: "素食优先", en: "Vegetarian first" },
  { value: "highProtein", zh: "高蛋白", en: "High protein" },
  { value: "lighter", zh: "轻负担", en: "Lighter meals" },
  { value: "noPork", zh: "不吃猪肉", en: "No pork" },
  { value: "noBeef", zh: "不吃牛肉", en: "No beef" },
];

const RESTRICTION_OPTIONS = [
  { value: "牛肉", zh: "牛肉", en: "Beef" },
  { value: "猪肉", zh: "猪肉", en: "Pork" },
  { value: "羊肉", zh: "羊肉", en: "Lamb" },
  { value: "虾", zh: "虾", en: "Shrimp" },
  { value: "蟹", zh: "蟹", en: "Crab" },
  { value: "鸡蛋", zh: "鸡蛋", en: "Eggs" },
  { value: "牛奶", zh: "牛奶", en: "Milk" },
  { value: "花生", zh: "花生", en: "Peanuts" },
];

function toggleArrayValue(values = [], value) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function OptionButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${
        active
          ? "bg-green-600 text-white border-green-600"
          : "bg-white text-gray-700 border-gray-200 hover:border-green-300"
      }`}
    >
      {children}
    </button>
  );
}

export default function PreferencesPage({
  preferences,
  setPreferences,
  onNext,
  onSkip,
}) {
  const { t } = useLanguage();
  const prefs = {
    tastes: [],
    quickMeals: false,
    allergens: [],
    dietType: [],
    restrictions: [],
    periodRestrictions: [],
    considerNutrition: false,
    ...preferences,
  };

  const update = (patch) => setPreferences({ ...prefs, ...patch });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg border border-gray-100 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">
            {t('偏好设置', 'Preferences')}
          </h1>
          <p className="text-gray-500 mt-2">
            {t(
              '这些是长期偏好，用来影响菜谱排序；本餐心情和速度可以在推荐面板临时调整。',
              'These long-term preferences affect recipe ranking. You can adjust mood and speed for each meal in the recommendation panel.'
            )}
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-black text-gray-900 mb-3">
              {t('口味偏好', 'Flavor preferences')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {TASTE_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  active={prefs.tastes.includes(option.value)}
                  onClick={() =>
                    update({
                      tastes: toggleArrayValue(prefs.tastes, option.value),
                    })
                  }
                >
                  {t(option.zh, option.en)}
                </OptionButton>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black text-gray-900 mb-3">
              {t('做饭方式', 'Cooking preferences')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
                <span>
                  <span className="block text-sm font-bold text-gray-800">
                    {t('优先快手菜', 'Prioritize quick meals')}
                  </span>
                  <span className="block text-xs text-gray-500 mt-1">
                    {t(
                      '会提升 20 分钟内、微波炉、空气炸锅等菜谱',
                      'Boosts recipes under 20 minutes and microwave or air-fryer meals'
                    )}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={prefs.quickMeals}
                  onChange={(e) => update({ quickMeals: e.target.checked })}
                  className="w-5 h-5"
                />
              </label>

              <label className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
                <span>
                  <span className="block text-sm font-bold text-gray-800">
                    {t('关注营养', 'Focus on nutrition')}
                  </span>
                  <span className="block text-xs text-gray-500 mt-1">
                    {t(
                      '会提升轻负担、高蛋白、蔬菜占比更高的菜谱',
                      'Boosts lighter, high-protein and vegetable-forward recipes'
                    )}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={prefs.considerNutrition}
                  onChange={(e) =>
                    update({ considerNutrition: e.target.checked })
                  }
                  className="w-5 h-5"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black text-gray-900 mb-3">
              {t('饮食方式', 'Diet')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {DIET_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  active={prefs.dietType.includes(option.value)}
                  onClick={() =>
                    update({
                      dietType: toggleArrayValue(prefs.dietType, option.value),
                    })
                  }
                >
                  {t(option.zh, option.en)}
                </OptionButton>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black text-gray-900 mb-3">
              {t('过敏 / 忌口', 'Allergies / restrictions')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {RESTRICTION_OPTIONS.map((option) => {
                const active =
                  prefs.allergens.includes(option.value) ||
                  prefs.restrictions.includes(option.value);
                return (
                  <OptionButton
                    key={option.value}
                    active={active}
                    onClick={() => {
                      const next = toggleArrayValue(
                        Array.from(
                          new Set([...prefs.allergens, ...prefs.restrictions])
                        ),
                        option.value
                      );
                      update({ allergens: next, restrictions: next });
                    }}
                  >
                    {t(option.zh, option.en)}
                  </OptionButton>
                );
              })}
            </div>
          </section>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onNext}
            className="flex-1 bg-gray-900 text-white py-3 rounded-lg font-black hover:bg-black transition"
          >
            {t('保存并继续', 'Save and continue')}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 bg-white text-gray-600 py-3 rounded-lg font-bold border border-gray-200 hover:bg-gray-50 transition"
          >
            {t('跳过', 'Skip')}
          </button>
        </div>
      </div>
    </div>
  );
}
