// FridgePanel.jsx
import React, { useMemo } from "react";
import { Clock, Plus } from "lucide-react";
import IngredientCard from "./IngredientCard";
import { getDaysLeft, isNonExpiringIngredient } from "../utils/dateUtils";
import {
  addStock,
  consumeFromBatch,
  getBatchExpiresAt,
  getBatchKey,
  normStorage,
  normalizeIngredient,
} from "../utils/inventory";
import { useDroppable } from "@dnd-kit/core";
import { useLanguage } from "../i18n/LanguageContext";

function FridgePanel({
  title = "我的冰箱",
  storageFilter,
  ingredients,
  setIngredients,
  onBack,
}) {
  const { t } = useLanguage();
  const storageId = storageFilter || "fridge";

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: storageId });

  const filteredIngredients = useMemo(() => {
    if (!storageFilter) return ingredients || [];
    return (ingredients || []).filter(
      (i) => normStorage(i.storage) === storageFilter
    );
  }, [ingredients, storageFilter]);

  const aggregated = useMemo(() => {
    const map = new Map();

    for (const raw of filteredIngredients) {
      const it = normalizeIngredient(raw);
      const key = getBatchKey(it);
      const expiresAt = getBatchExpiresAt(it);
      const prev = map.get(key);

      if (!prev) {
        map.set(key, { ...it, _expiresAt: expiresAt, _aggKey: key });
        continue;
      }

      const amount = (Number(prev.amount) || 0) + (Number(it.amount) || 0);
      // Show the oldest purchase in the group (it is the one used first).
      const pick =
        !isNonExpiringIngredient(it.storage, it.name) &&
        (it.purchaseDate || "") < (prev.purchaseDate || "")
          ? it
          : prev;
      map.set(key, { ...pick, amount, _expiresAt: expiresAt, _aggKey: key });
    }

    const arr = Array.from(map.values());

    // ✅ 排序规则
    if (storageFilter === "fridge") {
      arr.sort((a, b) => {
        const an = (a.name || "").localeCompare(b.name || "", "zh");
        if (an !== 0) return an;
        const ae = a._expiresAt || "9999-99-99";
        const be = b._expiresAt || "9999-99-99";
        return ae.localeCompare(be);
      });
    } else if (storageFilter === "freezer") {
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh"));
    } else {
      arr.sort(
        (a, b) =>
          getDaysLeft(a.purchaseDate, a.shelfLife, a.storage, a.name) -
          getDaysLeft(b.purchaseDate, b.shelfLife, b.storage, b.name)
      );
    }

    return arr;
  }, [filteredIngredients, storageFilter]);

  const updateAmount = (aggItem, delta) => {
    const batchKey = aggItem._aggKey || getBatchKey(aggItem);

    setIngredients((prev) => {
      const list = prev || [];

      if (delta > 0) {
        // A "+" is a new purchase today with the same shelf life.
        return addStock(list, {
          name: aggItem.name,
          amount: 1,
          unit: aggItem.unit,
          storage: normStorage(aggItem.storage || storageFilter),
          shelfLife: aggItem.shelfLife,
          category: aggItem.category,
        });
      }

      return consumeFromBatch(list, batchKey, 1).list;
    });
  };

  const emptyEmoji =
    storageFilter === "freezer"
      ? "❄️"
      : storageFilter === "fridge"
      ? "🧊"
      : storageFilter === "pantry"
      ? "🏠"
      : storageFilter === "condiment"
      ? "🧂"
      : "📦";

  return (
    <div
      className={`bg-white rounded-lg shadow-lg p-6 transition ${
        isOver ? "ring-2 ring-blue-300" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Clock className="text-blue-600" />
          {title}
        </h2>

        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm transition"
          type="button"
        >
          <Plus size={16} />
          {t('添加', 'Add')}
        </button>
      </div>

      {/* ✅ dropZone 覆盖空白区域，保证拖到空白也能接住 */}
      <div ref={setDropRef} className="min-h-[520px] rounded-xl">
        {aggregated.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">{emptyEmoji}</div>
            <p>
              {t(`${title} 还没有食材`, `No ingredients in ${title}`)}
            </p>
            <button
              onClick={onBack}
              className="mt-4 text-blue-600 hover:text-blue-700 transition"
              type="button"
            >
              {t('添加第一个食材 →', 'Add the first ingredient →')}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {aggregated.map((item) => (
                <IngredientCard
                  key={
                    item._aggKey ||
                    `${item.storage}__${item.name}__${item.unit}__${item._expiresAt}`
                  }
                  item={item}
                  onUpdateAmount={updateAmount}
                />
              ))}
            </div>

            <div className="text-xs text-gray-400 mt-3">
              {t(
                '提示：请从卡片左侧「⋮⋮」把手拖动。',
                'Tip: drag from the handle on the left side of a card.'
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FridgePanel;
