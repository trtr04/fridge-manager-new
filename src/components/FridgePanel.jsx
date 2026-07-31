// FridgePanel.jsx
import React, { useMemo } from "react";
import { Clock, Plus } from "lucide-react";
import IngredientCard from "./IngredientCard";
import { getDaysLeft, getTodayDate, isNonExpiringIngredient } from "../utils/dateUtils";
import { createIngredientId } from "../utils/ingredientIds";
import { useDroppable } from "@dnd-kit/core";
import { useLanguage } from "../i18n/LanguageContext";

function calcExpiresAt(purchaseDate, shelfLife, storage, name) {
  if (isNonExpiringIngredient(storage, name)) return "";
  if (!purchaseDate || typeof shelfLife !== "number") return "";
  const d = new Date(purchaseDate);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + shelfLife);
  return d.toISOString().split("T")[0];
}

function normStorage(s) {
  if (!s) return "fridge";
  if (s === "room") return "pantry";
  return s;
}

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

    for (const it of filteredIngredients) {
      const name = it.name;
      const storage = normStorage(it.storage || storageFilter || "fridge");
      const unit = it.unit || "";
      const shelfLife = typeof it.shelfLife === "number" ? it.shelfLife : 7;

      const expiresAt = calcExpiresAt(
        it.purchaseDate,
        shelfLife,
        storage,
        name
      );

      const key =
        isNonExpiringIngredient(storage, name)
          ? `${name}__${storage}__${unit}`
          : `${name}__${storage}__${unit}__${expiresAt}`;

      if (!map.has(key)) {
        map.set(key, {
          ...it,
          storage,
          unit,
          shelfLife,
          _expiresAt: expiresAt,
          _aggKey: key,
        });
      } else {
        const prev = map.get(key);
        const amount = (Number(prev.amount) || 0) + (Number(it.amount) || 0);

        if (!isNonExpiringIngredient(storage, name)) {
          const prevDays = getDaysLeft(
            prev.purchaseDate,
            prev.shelfLife,
            prev.storage,
            prev.name
          );
          const itDays = getDaysLeft(
            it.purchaseDate,
            it.shelfLife,
            it.storage,
            it.name
          );
          const pick = itDays < prevDays ? it : prev;
          map.set(key, {
            ...pick,
            amount,
            storage,
            unit,
            shelfLife,
            _expiresAt: expiresAt,
            _aggKey: key,
          });
        } else {
          map.set(key, {
            ...prev,
            amount,
            storage,
            unit,
            shelfLife: prev.shelfLife ?? 9999,
            _expiresAt: "",
            _aggKey: key,
          });
        }
      }
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
    const name = aggItem.name;
    const storage = normStorage(aggItem.storage || storageFilter || "fridge");
    const unit = aggItem.unit || "个";
    const shelfLife = typeof aggItem.shelfLife === "number" ? aggItem.shelfLife : 7;
    const expiresAt =
      aggItem._expiresAt ||
      calcExpiresAt(aggItem.purchaseDate, shelfLife, storage, name);

    setIngredients((prev) => {
      const list = [...(prev || [])];

      if (delta > 0) {
        list.push({
          id: createIngredientId(),
          name,
          amount: 1,
          unit,
          purchaseDate: getTodayDate(),
          storage,
          shelfLife: storage === "freezer" ? 9999 : shelfLife,
          baseShelfLife: aggItem.baseShelfLife,
        });
        return list;
      }

      const candidates = list
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => {
          const itStorage = normStorage(it.storage || "fridge");
          const itUnit = it.unit || "";
          if (it.name !== name) return false;
          if (itStorage !== storage) return false;
          if (itUnit !== (unit || "")) return false;

          if (isNonExpiringIngredient(storage, name)) return true;
          const itShelf = typeof it.shelfLife === "number" ? it.shelfLife : 7;
          const itExp = calcExpiresAt(it.purchaseDate, itShelf, itStorage, it.name);
          return itExp === expiresAt;
        });

      if (candidates.length === 0) return list;

      const { it: target, idx } = candidates[0];
      const newAmount = (Number(target.amount) || 0) - 1;

      if (newAmount <= 0) list.splice(idx, 1);
      else list[idx] = { ...target, amount: newAmount };

      return list;
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
