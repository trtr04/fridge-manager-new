const ALIASES = new Map([
  ["西红柿", "番茄"],
  ["番茄", "番茄"],
  ["大葱", "葱"],
  ["小葱", "葱"],
  ["香葱", "葱"],
  ["生姜", "姜"],
  ["老姜", "姜"],
  ["大蒜", "蒜"],
  ["蒜瓣", "蒜"],
  ["蒜头", "蒜"],
  ["食盐", "盐"],
  ["白砂糖", "糖"],
  ["白糖", "糖"],
  ["砂糖", "糖"],
  ["绵白糖", "糖"],
  ["生抽酱油", "生抽"],
  ["老抽酱油", "老抽"],
  ["植物油", "油"],
  ["食用油", "油"],
  ["花生油", "油"],
  ["菜籽油", "油"],
  ["玉米油", "油"],
  ["芝麻油", "香油"],
  ["麻油", "香油"],
  ["味精", "味素"],
  ["鸡精", "味素"],
  ["陈醋", "醋"],
  ["白醋", "醋"],
  ["米醋", "醋"],
  ["香醋", "醋"],
  ["料酒", "黄酒"],
  ["小米辣", "辣椒"],
  ["干辣椒", "辣椒"],
  ["红辣椒", "辣椒"],
  ["青辣椒", "青椒"],
  ["尖椒", "青椒"],
  ["红椒", "彩椒"],
  ["青红椒", "彩椒"],
  ["土豆", "马铃薯"],
  ["马铃薯", "马铃薯"],
  ["洋芋", "马铃薯"],
  ["圆白菜", "包菜"],
  ["卷心菜", "包菜"],
  ["高丽菜", "包菜"],
  ["花椰菜", "花菜"],
  ["菜花", "花菜"],
  ["猪肉末", "肉末"],
  ["猪肉馅", "肉末"],
  // Beef mince stays separate: "肉末" in recipes means pork mince.
  ["牛肉馅", "牛肉末"],
  ["鸡蛋", "鸡蛋"],
  ["蛋", "鸡蛋"],
  ["番茄酱", "番茄酱"],
  ["蕃茄", "番茄"],
]);

const COMBO_ALIASES = new Map([
  ["葱姜蒜", ["葱", "姜", "蒜"]],
  ["葱姜", ["葱", "姜"]],
  ["姜蒜", ["姜", "蒜"]],
  ["盐糖", ["盐", "糖"]],
  ["青红椒", ["青椒", "彩椒"]],
  ["葱姜蒜末", ["葱", "姜", "蒜"]],
  ["葱姜蒜片", ["葱", "姜", "蒜"]],
  ["葱姜蒜水", ["葱", "姜", "蒜"]],
  ["干湿淀粉", ["淀粉"]],
]);

export function normalizeIngredientName(name) {
  if (!name) return "";

  const normalized = String(name)
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/`/g, "")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/\s+/g, "")
    .replace(/[：:]+$/g, "")
    .trim();

  return ALIASES.get(normalized) || normalized;
}

export function explodeIngredientKeys(name) {
  const compact = normalizeIngredientName(name);
  if (!compact) return [];
  if (COMBO_ALIASES.has(compact)) return COMBO_ALIASES.get(compact);

  const splitParts = compact
    .split(/[、，,\/／+＋&和及与]/)
    .map(normalizeIngredientName)
    .filter(Boolean);

  if (splitParts.length > 1) {
    return Array.from(new Set(splitParts));
  }

  return [compact];
}
