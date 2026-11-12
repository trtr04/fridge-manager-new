import React, { useMemo, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import FridgePanel from "./FridgePanel";
import IngredientCard from "./IngredientCard";
import RecipePanel from "./RecipePanel";
import {
  getBatchKey,
  moveBetweenStorages,
  normalizeIngredient,
  isStorageArea,
} from "../utils/inventory";
import { useLanguage } from "../i18n/LanguageContext";

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

  // `value` is kept as the raw input string so the field can be cleared and
  // retyped; it is parsed and clamped only when the move is confirmed.
  const [moveModal, setMoveModal] = useState({
    open: false,
    max: 1,
    value: "1",
    payload: null,
  });

  const closeModal = () =>
    setMoveModal({ open: false, max: 1, value: "1", payload: null });

  const handleDragStart = (event) => {
    const data = event?.active?.data?.current;
    if (!data) return;

    const rep = list.find((it) => getBatchKey(it) === data.batchKey);
    setActiveAggItem(
      rep
        ? { ...rep, amount: data.amount, _aggKey: data.batchKey }
        : null
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
    if (!isStorageArea(toStorage)) return;

    const data = active?.data?.current;
    if (!data?.batchKey || !data.fromStorage) return;
    if (data.fromStorage === toStorage) return;

    const max = Math.max(1, Number(data.amount || 1));

    setMoveModal({
      open: true,
      max,
      value: String(max),
      payload: { toStorage, batchKey: data.batchKey },
    });
  };

  const parseMoveValue = (value, max) => {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.min(max, parsed));
  };

  const confirmMove = () => {
    const payload = moveModal.payload;
    if (!payload) return;

    const qty = parseMoveValue(moveModal.value, moveModal.max);
    closeModal();

    setIngredients((prev) => {
      const { list: next, movedQty } = moveBetweenStorages(prev || [], {
        batchKey: payload.batchKey,
        toStorage: payload.toStorage,
        qty,
      });
      return movedQty > 0 ? next : prev;
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
                      value: String(parseMoveValue(s.value, s.max) - 1 || 1),
                    }))
                  }
                >
                  −
                </button>

                <input
                  className="w-20 h-10 text-center rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-black text-base"
                  inputMode="numeric"
                  value={moveModal.value}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setMoveModal((s) => ({ ...s, value: raw }));
                  }}
                  onBlur={() =>
                    setMoveModal((s) => ({
                      ...s,
                      value: String(parseMoveValue(s.value, s.max)),
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmMove();
                  }}
                />

                <button
                  type="button"
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-lg"
                  onClick={() =>
                    setMoveModal((s) => ({
                      ...s,
                      value: String(
                        Math.min(s.max, parseMoveValue(s.value, s.max) + 1)
                      ),
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
