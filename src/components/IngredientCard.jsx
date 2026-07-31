// IngredientCard.jsx
import React from "react";
import { Plus, Minus, GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import {
  getDaysLeft,
  getStatusColor,
  getDaysSincePurchase,
  formatDaysSincePurchase,
  isNonExpiringIngredient,
} from "../utils/dateUtils";
import { useLanguage } from "../i18n/LanguageContext";
import {
  translateIngredientName,
  translateUnit
} from "../i18n/contentTranslations";

/**
 * 计算过期日期的辅助函数
 */
function calcExpiresAt(purchaseDate, shelfLife, storage, name) {
  if (isNonExpiringIngredient(storage, name)) return "";
  if (!purchaseDate || typeof shelfLife !== "number") return "";
  const d = new Date(purchaseDate);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + shelfLife);
  return d.toISOString().split("T")[0];
}

function IngredientCard({ item, onUpdateAmount, isOverlay = false }) {
  const { t, language } = useLanguage();
  const name = item?.name ?? "";
  const unit = item?.unit ?? "个";
  const storageRaw = item?.storage ?? "fridge";
  const storage = storageRaw === "room" ? "pantry" : storageRaw;
  const amount = Number(item?.amount ?? 0);
  const shelfLife = Number(item?.shelfLife ?? 0);
  const purchaseDate = item?.purchaseDate ?? "";

  // 计算剩余天数和状态颜色
  const daysLeft = getDaysLeft(purchaseDate, shelfLife, storage, name);
  const statusColor = getStatusColor(daysLeft, storage);

  // 获取过期日期（用于拖拽数据的唯一标识）
  const expiresAt = item?._expiresAt || calcExpiresAt(purchaseDate, shelfLife, storage, name);

  // 获取存储区域图标
  const getStorageIcon = (s) => {
    const icons = {
      freezer: "❄️",
      fridge: "🧊",
      pantry: "🏠",
      condiment: "🧂"
    };
    return icons[s] || "📦";
  };

  /**
   * ✨ 核心修改：动态显示文本
   * - 冷冻：固定显示"冷冻保存"
   * - 过期：无论哪个区都提示"已过期"
   * - 冷藏：显示"购买了 X 天"
   * - 其他：显示"剩余 X 天"
   */
  const getDaysText = (days, s, pDate) => {
    if (isNonExpiringIngredient(s, name)) {
      if (s === "freezer") return t("冷冻保存", "Frozen");
      if (s === "condiment") return t("长期保存", "Long-term storage");
      return t("常备品", "Pantry staple");
    }
    
    // 即使是冷藏，如果已经过期，也要优先显示警告
    if (days < 0) return t("⚠️ 已过期", "⚠️ Expired");

    // ✨ 冷藏区显示购买天数
    if (s === "fridge") {
      const daysSincePurchase = getDaysSincePurchase(pDate);
      return formatDaysSincePurchase(daysSincePurchase, language);
    }

    if (days === 0) return t("今天到期", "Expires today");
    return t(`剩余 ${days} 天`, `${days} days left`);
  };

  const dragId = `${name}__${storage}__${unit}__${expiresAt}`;

  const draggable = !isOverlay
    ? useDraggable({
        id: dragId,
        data: {
          name,
          unit,
          fromStorage: storage,
          amount,
          expiresAt,
        },
      })
    : null;

  const style = {
    transform: draggable?.transform
      ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`
      : undefined,
    zIndex: draggable?.isDragging ? 9999 : "auto",
    position: "relative",
  };

  return (
    <div
      ref={draggable?.setNodeRef}
      style={style}
      className={[
        "px-2.5 py-2 rounded-xl border-2 select-none transition-colors",
        statusColor,
        isOverlay ? "shadow-2xl scale-105" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        {/* 拖拽手柄 */}
        <button
          ref={draggable?.setActivatorNodeRef}
          {...draggable?.listeners}
          {...draggable?.attributes}
          className={[
            "w-7 h-7 rounded-lg bg-white/60 hover:bg-white/80 flex items-center justify-center transition-colors",
            isOverlay ? "cursor-grabbing" : "cursor-grab active:cursor-grabbing",
          ].join(" ")}
          title={t('拖拽移动', 'Drag to move')}
          type="button"
          disabled={isOverlay}
        >
          <GripVertical size={14} />
        </button>

        <div className="text-base leading-none">{getStorageIcon(storage)}</div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold truncate leading-tight">
              {name
                ? translateIngredientName(name, language)
                : t('（未命名）', '(Unnamed)')}
            </div>

            <div className="text-sm font-black whitespace-nowrap">
              {amount}
              <span className="text-[11px] font-semibold opacity-70 ml-1">
                {translateUnit(unit, language)}
              </span>
            </div>
          </div>

          {/* 状态文本：冷藏显示"购买了X天"，其他显示剩余天数 */}
          <div className="text-[10px] sm:text-[11px] opacity-75 truncate mt-0.5 font-medium">
            {getDaysText(daysLeft, storage, purchaseDate)}
          </div>
        </div>

        {/* 数量调整按钮 */}
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={() => onUpdateAmount?.(item, 1)}
            className="w-7 h-7 rounded-lg bg-white/60 hover:bg-white/80 flex items-center justify-center transition-colors"
            type="button"
            title={t('增加数量', 'Increase quantity')}
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => onUpdateAmount?.(item, -1)}
            className="w-7 h-7 rounded-lg bg-white/60 hover:bg-white/80 flex items-center justify-center transition-colors"
            type="button"
            title={t('减少数量', 'Decrease quantity')}
          >
            <Minus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default IngredientCard;
