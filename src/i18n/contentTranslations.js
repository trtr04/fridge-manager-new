const INGREDIENT_NAMES = {
  鸡蛋: 'Eggs',
  牛奶: 'Milk',
  洋葱: 'Onion',
  马铃薯: 'Potato',
  土豆: 'Potato',
  番茄: 'Tomato',
  鸡胸肉: 'Chicken breast',
  牛肉: 'Beef',
  猪肉: 'Pork',
  羊肉: 'Lamb',
  鸡肉: 'Chicken',
  虾: 'Shrimp',
  活虾: 'Fresh shrimp',
  蟹: 'Crab',
  鱼: 'Fish',
  豆腐: 'Tofu',
  老豆腐: 'Firm tofu',
  葱: 'Scallion',
  姜: 'Ginger',
  蒜: 'Garlic',
  油: 'Cooking oil',
  食用油: 'Cooking oil',
  盐: 'Salt',
  糖: 'Sugar',
  醋: 'Vinegar',
  香醋: 'Aromatic vinegar',
  生抽: 'Light soy sauce',
  老抽: 'Dark soy sauce',
  酱油: 'Soy sauce',
  蚝油: 'Oyster sauce',
  料酒: 'Cooking wine',
  黄酒: 'Cooking wine',
  香油: 'Sesame oil',
  芝麻油: 'Sesame oil',
  淀粉: 'Starch',
  水: 'Water',
  热水: 'Hot water',
  胡椒粉: 'Pepper',
  白胡椒: 'White pepper',
  黑胡椒: 'Black pepper',
  花椒: 'Sichuan pepper',
  八角: 'Star anise',
  桂皮: 'Cinnamon',
  香叶: 'Bay leaf',
  辣椒: 'Chili',
  干辣椒: 'Dried chili',
  青椒: 'Green pepper',
  彩椒: 'Bell pepper',
  花生: 'Peanuts',
  芝麻: 'Sesame',
  白糖: 'Sugar',
  冰糖: 'Rock sugar',
  食盐: 'Salt',
  鸡精: 'Chicken bouillon',
  味精: 'MSG',
  味素: 'MSG',
  小米辣: "Bird's eye chili",
  小葱: 'Scallion',
  西红柿: 'Tomato',
  金针菇: 'Enoki mushrooms',
  蛏子: 'Razor clams',
  鳊鱼: 'Bream',
  泡面: 'Instant noodles',
  方便面: 'Instant noodles',
  莴笋叶: 'Lettuce leaves',
  搅拌器: 'Whisk',
  搅拌机: 'Blender',
  微波炉: 'Microwave',
  空气炸锅: 'Air fryer',
  烤箱: 'Oven',
  电饭煲: 'Rice cooker',
  锅: 'Pan'
};

const UNIT_NAMES = {
  个: 'pcs',
  盒: 'carton',
  包: 'pack',
  块: 'pcs'
};

export function translateIngredientName(name, language) {
  if (language !== 'en') return name;
  return INGREDIENT_NAMES[name] || name;
}

export function translateUnit(unit, language) {
  if (language !== 'en') return unit;
  return UNIT_NAMES[unit] || unit;
}

export function translateIngredientList(items, language) {
  return (items || []).map((item) =>
    translateIngredientName(item, language)
  );
}

const COMPLETE_TEXT_TRANSLATIONS = {
  白灼虾: 'Blanched shrimp',
  鳊鱼炖豆腐: 'Bream and tofu stew',
  蛏抱蛋: 'Razor clams with egg',
  微波炉荷包蛋: 'Microwave poached egg',
  朱雀汤: 'Suzaku soup',
  微波炉鸡蛋羹: 'Microwave steamed egg custard',
  煮泡面加蛋: 'Instant noodles with egg',
  炒滑蛋: 'Soft scrambled eggs',
  鸡蛋花: 'Egg drop soup',
  西红柿炒鸡蛋: 'Tomato and egg stir-fry',
  番茄炒蛋: 'Tomato and egg stir-fry',
  葱炒鸡蛋: 'Scallion and egg stir-fry',
  煎饼: 'Savory pancake',
  油醋爆蛋: 'Oil-and-vinegar egg',
  鸡蛋羹: 'Steamed egg custard'
};

export function translateIngredientText(text, language) {
  if (language !== 'en' || !text) return text;

  const source = String(text).trim();
  if (COMPLETE_TEXT_TRANSLATIONS[source]) {
    return COMPLETE_TEXT_TRANSLATIONS[source];
  }

  const parentheticalNotes = source.match(/（[^）]*）/g) || [];
  const isOptional = parentheticalNotes.some((note) =>
    /可选|如需要|不吃|可以不放/.test(note)
  );
  let translated = source.replace(/（[^）]*）/g, ' ');

  Object.entries(INGREDIENT_NAMES)
    .sort(([a], [b]) => b.length - a.length)
    .forEach(([chinese, english]) => {
      translated = translated.split(chinese).join(` ${english} `);
    });

  translated = translated
    .replace(/、/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  // Avoid awkward half-translations such as “微波炉Eggs羹”. Imported recipe
  // content stays intact unless the complete phrase can be translated safely.
  if (/[\u3400-\u9fff]/.test(translated)) return source;
  return `${translated}${isOptional ? ' (optional)' : ''}`;
}

export function translateRecipeTitle(title, categoryLabel, index, language) {
  if (language !== 'en') return title;

  const translated = translateIngredientText(title, language);
  if (!/[\u3400-\u9fff]/.test(translated)) return translated;

  return `${categoryLabel || 'Recipe'} Recipe ${index + 1}`;
}
