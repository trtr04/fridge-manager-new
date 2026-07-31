export const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

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

// freezer / condiment / oil：视为长期保存，不参与倒计时
export const getDaysLeft = (purchaseDate, shelfLife, storage = 'fridge', name = '') => {
  const s = storage || 'fridge';
  if (isNonExpiringIngredient(s, name)) return 9999;

  const purchase = new Date(purchaseDate);
  const today = new Date();

  const life = Number(shelfLife) || 0;
  const expiry = purchase.getTime() + life * 24 * 60 * 60 * 1000;

  const diff = Math.ceil((expiry - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
};

export const getStatusColor = (daysLeft, storage = 'fridge') => {
  const s = storage || 'fridge';

  // 长期保存：蓝色系
  if (s === 'freezer' || s === 'condiment' || daysLeft >= 9999) {
    return 'bg-blue-50 border-blue-200 text-blue-800';
  }

  if (daysLeft <= 1) return 'bg-red-100 border-red-300 text-red-800';
  if (daysLeft <= 3) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
  return 'bg-green-100 border-green-300 text-green-800';
};

/**
 * ✨ 计算从购买日期到今天过了几天
 * @param {string} dateString - ISO 格式日期字符串 (YYYY-MM-DD)
 * @returns {number} - 购买天数（0 表示今天购买）
 */
export const getDaysSincePurchase = (dateString) => {
  if (!dateString) return 0;
  
  const purchaseDate = new Date(dateString);
  if (isNaN(purchaseDate.getTime())) return 0;
  
  const today = new Date();
  
  // 重置时间为 00:00:00 以便只计算日期差异
  purchaseDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - purchaseDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

/**
 * 格式化购买天数为文本
 * @param {number} days - 购买天数
 * @returns {string} - 格式化文本
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
