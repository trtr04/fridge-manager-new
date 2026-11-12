// All dates in the app are calendar dates ("YYYY-MM-DD") in the user's local
// time zone. Never parse them with `new Date("YYYY-MM-DD")`: that is UTC
// midnight, which is the previous evening anywhere west of Greenwich and made
// "bought today" show as "bought yesterday" in the US.

const DAY_MS = 24 * 60 * 60 * 1000;

// Shelf life used as a "never expires" sentinel by older versions of the app.
export const NON_EXPIRING_DAYS = 9999;

const pad = (value) => String(value).padStart(2, '0');

export const formatLocalDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const getTodayDate = (now = new Date()) => formatLocalDate(now);

export function parseLocalDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

// Whole-day index of a local calendar date. Using Date.UTC on the local
// components keeps the difference exact across daylight-saving changes.
function dayNumber(date) {
  return Math.round(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS
  );
}

export function addDaysToDate(dateString, days) {
  const date = parseLocalDate(dateString);
  const amount = Number(days);
  if (!date || !Number.isFinite(amount)) return '';
  date.setDate(date.getDate() + amount);
  return formatLocalDate(date);
}

const NON_EXPIRING_NAMES = new Set([
  '油',
  '食用油',
  '植物油',
  '花生油',
  '菜籽油',
  '玉米油',
  '橄榄油',
  '调和油',
  '芝麻油',
  '香油',
  '麻油',
]);

export const isNonExpiringIngredient = (storage = 'fridge', name = '') => {
  const s = storage || 'fridge';
  const n = String(name || '').trim();
  return s === 'freezer' || s === 'condiment' || NON_EXPIRING_NAMES.has(n);
};

// Expiry date as "YYYY-MM-DD", or "" for long-term items.
export const getExpiresAt = (
  purchaseDate,
  shelfLife,
  storage = 'fridge',
  name = ''
) => {
  if (isNonExpiringIngredient(storage, name)) return '';
  return addDaysToDate(purchaseDate, shelfLife);
};

// freezer / condiment / oil：视为长期保存，不参与倒计时
// 0 = expires today, negative = already expired.
export const getDaysLeft = (
  purchaseDate,
  shelfLife,
  storage = 'fridge',
  name = '',
  now = new Date()
) => {
  if (isNonExpiringIngredient(storage || 'fridge', name)) {
    return NON_EXPIRING_DAYS;
  }

  const life = Number(shelfLife) || 0;
  const purchase = parseLocalDate(purchaseDate);
  // A missing purchase date is treated as "bought today".
  if (!purchase) return life;

  return dayNumber(purchase) + life - dayNumber(now);
};

export const getStatusColor = (daysLeft, storage = 'fridge') => {
  const s = storage || 'fridge';

  // 长期保存：蓝色系
  if (s === 'freezer' || s === 'condiment' || daysLeft >= NON_EXPIRING_DAYS) {
    return 'bg-blue-50 border-blue-200 text-blue-800';
  }

  if (daysLeft <= 1) return 'bg-red-100 border-red-300 text-red-800';
  if (daysLeft <= 3) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
  return 'bg-green-100 border-green-300 text-green-800';
};

/**
 * 计算从购买日期到今天过了几天（0 表示今天购买）
 * @param {string} dateString - YYYY-MM-DD
 */
export const getDaysSincePurchase = (dateString, now = new Date()) => {
  const purchase = parseLocalDate(dateString);
  if (!purchase) return 0;
  return Math.max(0, dayNumber(now) - dayNumber(purchase));
};

/**
 * 格式化购买天数为文本
 */
export const formatDaysSincePurchase = (days, language = 'zh') => {
  if (language === 'en') {
    if (days === 0) return 'Purchased today';
    if (days === 1) return 'Purchased yesterday';
    return `Stored for ${days} days`;
  }
  if (days === 0) return "今天购买";
  if (days === 1) return "昨天购买";
  return `已存放 ${days} 天`;
};
