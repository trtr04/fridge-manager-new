import React, { useMemo, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import FridgePanel from "./FridgePanel";
import IngredientCard from "./IngredientCard";
import RecipePanel from "./RecipePanel";
import { getTodayDate, isNonExpiringIngredient } from "../utils/dateUtils";
import { createIngredientId } from "../utils/ingredientIds";
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

function normalizeIngredient(it) {
  const storage = normStorage(it.storage || "fridge");
  return {
    ...it,
    purchaseDate: it.purchaseDate ?? it.purchase_date,
    shelfLife: typeof it.shelfLife === "number" ? it.shelfLife : it.shelf_life,
    storage,
    unit: it.unit || "个",
    amount: Number(it.amount || 0),
  };
}

function consumeFromList(
  list,
  { name, unit, fromStorage, expiresAt, qty, matchExpiresAt }
) {
  const next = [...list];
  let need = qty;

  for (let i = 0; i < next.length && need > 0; i++) {
    const it = next[i];
    const itStorage = normStorage(it.storage || "fridge");
    if (itStorage !== fromStorage) continue;
    if (it.name !== name) continue;
    if ((it.unit || "") !== (unit || "")) continue;

    if (matchExpiresAt) {
      const itShelf = typeof it.shelfLife === "number" ? it.shelfLife : 7;
      const itExp = calcExpiresAt(it.purchaseDate, itShelf, itStorage, it.name);
      if (itExp !== expiresAt) continue;
    }

    const cur = Number(it.amount || 0);
    if (cur <= 0) continue;

    const take = Math.min(cur, need);
    const left = cur - take;

    if (left <= 0) {
      next.splice(i, 1);
      i -= 1;
    } else {
      next[i] = { ...it, amount: left };
    }

    need -= take;
  }

  return { nextList: next, removedQty: qty - need };
}

export default function MainPage({
  ingredients,
  setIngredients,
  preferences,
  onClearFridge,
  onAddToStorage,
  onEditPreferences,
}) {
  const { t } = useLanguage();
  const list = useMemo(
    () => (ingredients || []).map(normalizeIngredient),
    [ingredients]
  );

  const [activeAggItem, setActiveAggItem] = useState(null);

  const [moveModal, setMoveModal] = useState({
    open: false,
    max: 1,
    value: 1,
    payload: null,
  });

  const closeModal = () =>
    setMoveModal({ open: false, max: 1, value: 1, payload: null });

  const handleDragStart = (event) => {
    const data = event?.active?.data?.current;
    if (!data) return;

    const rep = list.find((it) => {
      const itStorage = normStorage(it.storage || "fridge");
      if (it.name !== data.name) return false;
      if ((it.unit || "") !== (data.unit || "")) return false;
      if (itStorage !== data.fromStorage) return false;

      if (isNonExpiringIngredient(data.fromStorage, data.name)) return true;

      const itShelf = typeof it.shelfLife === "number" ? it.shelfLife : 7;
      const itExp = calcExpiresAt(
        it.purchaseDate,
        itShelf,
        itStorage,
        it.name
      );
      return itExp === data.expiresAt;
    });

    setActiveAggItem(
      rep
        ? { ...rep, amount: data.amount, _expiresAt: data.expiresAt }
        : {
            id: "overlay",
            name: data.name,
            unit: data.unit,
            storage: data.fromStorage,
            amount: data.amount,
            purchaseDate: getTodayDate(),
            shelfLife: data.fromStorage === "freezer" ? 9999 : 7,
            _expiresAt: data.expiresAt,
          }
    );
  };

  const handleDragCancel = () => {
    setActiveAggItem(null);
    closeModal();
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveAggItem(null);

    if (!over) return;

    const toStorage = over.id;
    const ALLOWED = new Set(["fridge", "freezer", "pantry", "condiment"]);
    if (!ALLOWED.has(toStorage)) return;

    const data = active?.data?.current;
    if (!data) return;

    const { name, unit, fromStorage, amount, expiresAt } = data;
    if (!name || !fromStorage || fromStorage === toStorage) return;

    const max = Math.max(1, Number(amount || 1));

    setMoveModal({
      open: true,
      max,
      value: max,
      payload: {
        toStorage,
        data: { name, unit, fromStorage, expiresAt, total: max },
      },
    });
  };

  const confirmMove = () => {
    const payload = moveModal.payload;
    if (!payload) return;

    const qty = Math.max(
      1,
      Math.min(moveModal.max, Number(moveModal.value || 1))
    );
    const { toStorage, data } = payload;
    const { name, unit, fromStorage, expiresAt } = data;

    closeModal();

    setIngredients((prev) => {
      const base = (prev || []).map(normalizeIngredient);

      const matchExpiresAt = !isNonExpiringIngredient(fromStorage, name);

      const { nextList: afterConsume, removedQty } = consumeFromList(base, {
        name,
        unit,
        fromStorage,
        expiresAt,
        qty,
        matchExpiresAt,
      });

      if (removedQty <= 0) return prev;

      const today = getTodayDate();

      let newItem;
      if (fromStorage === "freezer" && toStorage === "fridge") {
        newItem = {
          id: createIngredientId(),
          name,
          unit: unit || "个",
          amount: removedQty,
          storage: "fridge",
          purchaseDate: today,
          shelfLife: 2,
        };
      } else {
        const rep = base.find((it) => {
          const s = normStorage(it.storage || "fridge");
          if (s !== fromStorage) return false;
          if (it.name !== name) return false;
          if ((it.unit || "") !== (unit || "")) return false;
          if (!matchExpiresAt) return true;

          const itShelf = typeof it.shelfLife === "number" ? it.shelfLife : 7;
          const itExp = calcExpiresAt(it.purchaseDate, itShelf, s, it.name);
          return itExp === expiresAt;
        });

        newItem = {
          id: createIngredientId(),
          name,
          unit: unit || rep?.unit || "个",
          amount: removedQty,
          storage: toStorage,
          purchaseDate: rep?.purchaseDate || today,
          shelfLife:
            toStorage === "freezer"
              ? 9999
              : typeof rep?.shelfLife === "number"
              ? rep.shelfLife
              : 7,
        };
      }

      return [...afterConsume, newItem];
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <div className="text-2xl font-black text-gray-900">
              {t('🧊 冰箱托管', '🧊 Fridge Manager')}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {t(
                '四个板块：冷藏 / 冷冻 / 常温 / 调味料（支持拖拽与加减）',
                'Four zones: refrigerated, frozen, pantry and seasonings. Drag items or adjust quantities.'
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onEditPreferences}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition"
              type="button"
            >
              {t('偏好', 'Preferences')}
            </button>
            <button
              onClick={onClearFridge}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition"
              type="button"
            >
              {t('清空', 'Clear')}
            </button>
          </div>
        </div>

        <DndContext
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <div className="w-full overflow-x-auto">
            <div className="grid grid-cols-4 gap-4 min-w-[1100px]">
              <FridgePanel
                title={t('🧊 冷藏', '🧊 Refrigerated')}
                storageFilter="fridge"
                ingredients={list}
                setIngredients={setIngredients}
                onBack={() => onAddToStorage?.("fridge")}
              />
              <FridgePanel
                title={t('❄️ 冷冻', '❄️ Frozen')}
                storageFilter="freezer"
                ingredients={list}
                setIngredients={setIngredients}
                onBack={() => onAddToStorage?.("freezer")}
              />
              <FridgePanel
                title={t('🏠 常温', '🏠 Pantry')}
                storageFilter="pantry"
                ingredients={list}
                setIngredients={setIngredients}
                onBack={() => onAddToStorage?.("pantry")}
              />
              <FridgePanel
                title={t('🧂 调味料', '🧂 Seasonings')}
                storageFilter="condiment"
                ingredients={list}
                setIngredients={setIngredients}
                onBack={() => onAddToStorage?.("condiment")}
              />
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeAggItem ? (
              <div className="pointer-events-none">
                <IngredientCard item={activeAggItem} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* ✅ 恢复：下面的菜谱区 */}
        <div className="mt-8">
          <RecipePanel
            ingredients={list}
            setIngredients={setIngredients}
            preferences={preferences}
          />
        </div>

        {/* ✅ 移动数量弹窗 */}
        {moveModal.open && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={closeModal}
            />
            <div className="relative w-[360px] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6">
              <div className="text-lg font-black text-gray-900">
                {t('移动数量', 'Move quantity')}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {t(
                  `请输入要移动的数量（1 ~ ${moveModal.max}）`,
                  `Enter the quantity to move (1–${moveModal.max})`
                )}
              </div>

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-lg"
                  onClick={() =>
                    setMoveModal((s) => ({
                      ...s,
                      value: Math.max(1, Number(s.value || 1) - 1),
                    }))
                  }
                >
                  −
                </button>

                <input
                  className="w-20 h-10 text-center rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-black text-base"
                  value={moveModal.value}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    setMoveModal((s) => ({
                      ...s,
                      value: Math.max(1, Math.min(s.max, v)),
                    }));
                  }}
                />

                <button
                  type="button"
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-lg"
                  onClick={() =>
                    setMoveModal((s) => ({
                      ...s,
                      value: Math.min(s.max, Number(s.value || 1) + 1),
                    }))
                  }
                >
                  +
                </button>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  className="flex-1 h-10 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 font-bold"
                  onClick={closeModal}
                >
                  {t('取消', 'Cancel')}
                </button>
                <button
                  type="button"
                  className="flex-1 h-10 rounded-xl bg-gray-900 hover:bg-black text-white font-black"
                  onClick={confirmMove}
                >
                  {t('确认移动', 'Move')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
