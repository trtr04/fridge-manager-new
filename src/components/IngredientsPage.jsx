// IngredientsPage.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import { quickTemplates } from '../utils/templates';
import { getTodayDate } from '../utils/dateUtils';
import { createIngredientId } from '../utils/ingredientIds';
import { addStock, consumeByName } from '../utils/inventory';
import { validateIngredientDraft } from '../utils/ingredientValidation';
import { useLanguage } from '../i18n/LanguageContext';

// 本地存储自定义模板的 Key
const LS_CUSTOM_TEMPLATES = 'fm_customTemplates_v1';
const TEMPLATE_ENGLISH_NAMES = {
  鸡蛋: 'Eggs',
  牛奶: 'Milk',
  洋葱: 'Onion',
  土豆: 'Potato',
  番茄: 'Tomato',
  鸡胸肉: 'Chicken breast'
};
const CATEGORY_ENGLISH_NAMES = {
  肉类: 'Meat',
  蔬菜: 'Vegetables',
  水果: 'Fruit',
  蛋类: 'Eggs',
  乳制品: 'Dairy',
  饮料: 'Drinks',
  主食: 'Staples',
  调味: 'Seasonings',
  其他: 'Other'
};
const STORAGE_LABELS = {
  fridge: ['冷藏', 'Refrigerated'],
  freezer: ['冷冻', 'Frozen'],
  pantry: ['常温', 'Pantry'],
  condiment: ['调味料', 'Seasonings']
};

function getCustomTemplatesStorageKey(userId = null) {
  return `${LS_CUSTOM_TEMPLATES}:${
    userId ? `user:${userId}` : 'guest'
  }`;
}

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function IngredientsPage({ ingredients, setIngredients, onComplete, user }) {
  const { t, language } = useLanguage();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');
  const customTemplatesStorageKey = getCustomTemplatesStorageKey(user?.id);
  const [customTemplates, setCustomTemplates] = useState(() => {
    const scopedTemplates = loadLS(customTemplatesStorageKey, null);
    if (scopedTemplates !== null) return scopedTemplates;

    // Preserve legacy templates only for the guest scope. Copying them into a
    // signed-in user's scope could expose another local user's ingredient names.
    return user?.id ? [] : loadLS(LS_CUSTOM_TEMPLATES, []);
  });

  useEffect(() => {
    saveLS(customTemplatesStorageKey, customTemplates);
  }, [customTemplates, customTemplatesStorageKey]);

  const [newIngredient, setNewIngredient] = useState({
    name: '', 
    amount: '', 
    unit: '个', 
    purchaseDate: getTodayDate(), 
    storage: 'fridge', 
    shelfLife: 7, 
    category: '其他',
  });

  // 合并内置和自定义模板
  const allTemplates = useMemo(() => {
    const map = new Map();
    quickTemplates.forEach(t => map.set(t.name, { ...t, source: 'builtin' }));
    customTemplates.forEach(t => map.set(t.name, { ...t, source: 'custom' }));
    return Array.from(map.values());
  }, [customTemplates]);

  // 计算当前冰箱里某种食材的总量
  const getCount = (name) => ingredients.filter(i => i.name === name).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  /* -------- 1. 点击卡片增加数量 (+1) -------- */
  // Each tap is one item bought today: same-day stock is topped up, while an
  // older batch keeps its own purchase date and expiry.
  const onAddTemplate = (template) => {
    setIngredients((prev) =>
      addStock(prev || [], {
        name: template.name,
        amount: 1,
        unit: template.unit,
        storage: template.storage,
        shelfLife: template.shelfLife,
        category: template.category || '其他',
      })
    );
  };

  /* -------- 2. 减少数量：优先消耗最早到期的批次 -------- */
  const decreaseCountByOne = (name) => {
    setIngredients((prev) => consumeByName(prev || [], name, 1).list);
  };

  /* -------- 3. 手动添加逻辑 -------- */
  const addIngredient = () => {
    const { ingredient, error } = validateIngredientDraft(
      newIngredient,
      language
    );
    if (error) {
      setFormError(error);
      return;
    }

    setFormError('');
    const name = ingredient.name;
    const newItem = { 
      ...ingredient,
      id: createIngredientId(),
      created_at: new Date().toISOString()
    };

    // 将此新食材存入“常用模板”
    setCustomTemplates(prev => {
      const rest = prev.filter(t => t.name !== name);
      return [...rest, { 
        name, 
        unit: newItem.unit, 
        shelfLife: newItem.shelfLife, 
        storage: newItem.storage, 
        category: newItem.category 
      }];
    });

    setIngredients(prev => [...prev, newItem]);

    // 重置表单
    setNewIngredient({ 
      name: '', 
      amount: '', 
      unit: '个', 
      purchaseDate: getTodayDate(), 
      storage: 'fridge', 
      shelfLife: 7, 
      category: '其他' 
    });
    setShowAddForm(false);
  };

  // 模板分组
  const groupedTemplates = useMemo(() => {
    const groups = {};
    allTemplates.forEach(t => {
      const c = t.category || '其他';
      if (!groups[c]) groups[c] = [];
      groups[c].push(t);
    });
    const order = ['肉类', '蔬菜', '水果', '蛋类', '乳制品', '饮料', '主食', '调味', '其他'];
    const ordered = {};
    order.forEach(k => { if (groups[k]) ordered[k] = groups[k]; });
    return ordered;
  }, [allTemplates]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-3xl font-black text-gray-800 mb-2">
            {t('🍎 添加食材', '🍎 Add ingredients')}
          </h2>
          <p className="text-gray-500 mb-8">
            {t(
              '点击卡片快速录入，同步至云端冰箱',
              'Tap a card to add it and sync it to your cloud fridge'
            )}
          </p>

          <div className="space-y-10">
            {Object.entries(groupedTemplates).map(([category, items]) => (
              <div key={category}>
                <h3 className="flex items-center gap-2 text-sm font-bold text-blue-600 uppercase tracking-widest mb-4">
                  <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                  {t(
                    category,
                    CATEGORY_ENGLISH_NAMES[category] || category
                  )}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {items.map((template, idx) => {
                    const count = getCount(template.name);
                    const isAdded = count > 0;
                    return (
                      <div key={idx} className="relative group">
                        <button
                          onClick={() => onAddTemplate(template)}
                          className={`w-full p-4 border-2 rounded-2xl text-left transition-all duration-200 ${
                            isAdded ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]' : 'border-gray-100 hover:border-blue-200 hover:bg-white'
                          }`}
                        >
                          <div className="font-bold text-gray-800">
                            {t(
                              template.name,
                              TEMPLATE_ENGLISH_NAMES[template.name] ||
                                template.name
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1 uppercase">
                            {t(
                              STORAGE_LABELS[template.storage]?.[0] ||
                                template.storage,
                              STORAGE_LABELS[template.storage]?.[1] ||
                                template.storage
                            )}{' '}
                            · {template.shelfLife}
                            {t('天', ' days')}
                          </div>
                          
                          <div className="absolute top-3 right-3 flex items-center gap-2">
                            {isAdded && (
                              <span className="bg-blue-600 text-white text-xs font-black px-2 py-0.5 rounded-lg">
                                {count}
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                // 新加的调试日志：点击时控制台会变红
                                console.log("%c🖱️ UI反馈: 减号被点击了", "color: #ff4d4f; font-weight: bold");
                                
                                e.preventDefault();
                                e.stopPropagation(); // ⚡️ 核心：阻止点击传给父元素（也就是那个大卡片）
                            
                                if (count > 0) {
                                  decreaseCountByOne(template.name);
                                }
                              }}
                              // 保持你原来的 className 不变
                              className={`p-1 rounded-full border transition-colors ${
                                count > 0 
                                  ? 'text-blue-600 border-blue-200 hover:bg-blue-200' 
                                  : 'text-gray-100 border-gray-50 cursor-not-allowed text-gray-200'
                              }`}
                              disabled={count === 0}
                            >
                              <Minus size={14} />
                            </button>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 手动添加表单 */}
          <div className="mt-12 border-t border-gray-100 pt-8">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setFormError('');
              }}
              className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-bold"
            >
              {showAddForm
                ? t('收起表单', 'Close form')
                : <><Plus size={20} /> {t('手动输入新食材', 'Add a custom ingredient')}</>}
            </button>

            {showAddForm && (
              <div className="mt-6 p-6 bg-gray-50 rounded-2xl space-y-4 border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 ml-1">
                      {t('食材名称', 'Ingredient name')}
                    </label>
                    <input
                      placeholder={t(
                        '例如：波士顿龙虾',
                        'Example: Boston lobster'
                      )}
                      maxLength={120}
                      value={newIngredient.name}
                      onChange={e => {
                        setFormError('');
                        setNewIngredient({ ...newIngredient, name: e.target.value });
                      }}
                      className="w-full p-3 bg-white border-0 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 ml-1">
                      {t('数量 & 单位', 'Amount & unit')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={t('数量', 'Amount')}
                        min="0.001"
                        max="1000000"
                        step="any"
                        value={newIngredient.amount}
                        onChange={e => {
                          setFormError('');
                          setNewIngredient({ ...newIngredient, amount: e.target.value });
                        }}
                        className="flex-1 p-3 bg-white border-0 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <select 
                        value={newIngredient.unit}
                        onChange={e => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                        className="w-24 p-3 bg-white border-0 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="个">{t('个', 'pcs')}</option>
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="盒">{t('盒', 'carton')}</option>
                        <option value="包">{t('包', 'pack')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 ml-1">
                      {t('保存方式', 'Storage')}
                    </label>
                    <select
                      value={newIngredient.storage}
                      onChange={e => setNewIngredient({ ...newIngredient, storage: e.target.value })}
                      className="w-full p-3 bg-white border-0 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="fridge">
                        ❄️ {t('冷藏', 'Refrigerated')}
                      </option>
                      <option value="freezer">
                        🧊 {t('冷冻', 'Frozen')}
                      </option>
                      <option value="pantry">
                        🏠 {t('常温', 'Pantry')}
                      </option>
                      <option value="condiment">
                        🧂 {t('调味料', 'Seasonings')}
                      </option>
                    </select>
                  </div>

                  {/* ✅ 修复：手动输入保质期 */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 ml-1">
                      {t('保质期 (天)', 'Shelf life (days)')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="36500"
                      step="1"
                      value={newIngredient.shelfLife}
                      onChange={e => {
                        setFormError('');
                        setNewIngredient({
                          ...newIngredient,
                          shelfLife: e.target.value
                        });
                      }}
                      className="w-full p-3 bg-white border-0 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {formError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    {formError}
                  </p>
                )}

                <button
                  onClick={addIngredient}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg hover:bg-blue-700 transition-all shadow-lg"
                >
                  {t('确认添加', 'Add ingredient')}
                </button>
              </div>
            )}
          </div>

          <div className="mt-12 flex gap-4">
            <button
              onClick={onComplete}
              className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-black transition-all shadow-xl"
            >
              {t('完成并查看冰箱', 'Finish and view fridge')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IngredientsPage;
