import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  explodeIngredientKeys,
  normalizeIngredientName,
} from "../src/utils/ingredientNormalize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dishesRoot = path.join(projectRoot, "data", "howtocook", "dishes");
const outputPath = path.join(projectRoot, "src", "data", "howToCookRecipes.json");

function walkMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Missing HowToCook dishes directory: ${dir}`);
  }

  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(fullPath));
    } else if (entry.isFile() && fullPath.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results.sort((a, b) => a.localeCompare(b, "zh"));
}

function getRelativePath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function getRecipePath(filePath) {
  return path.relative(path.join(projectRoot, "data", "howtocook"), filePath)
    .split(path.sep)
    .join("/");
}

function slugFromRecipePath(recipePath) {
  return recipePath.replace(/^dishes\//, "").replace(/\.md$/i, "");
}

function extractSection(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+${heading}\\s*$`);
  const startIndex = lines.findIndex((line) => headingPattern.test(line.trim()));

  if (startIndex === -1) return [];

  const sectionLines = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+/.test(line.trim())) break;
    sectionLines.push(line);
  }

  return sectionLines;
}

function cleanBulletText(line) {
  return line
    .replace(/^[-*+]\s+/, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBulletSection(markdown, heading) {
  return extractSection(markdown, heading)
    .map((line) => line.trim())
    .filter((line) => /^[-*+]\s+/.test(line))
    .map(cleanBulletText)
    .filter(Boolean);
}

function parseNumberedSection(markdown, heading) {
  return extractSection(markdown, heading)
    .map((line) => line.trim())
    .filter((line) => /^\d+[.、]\s+/.test(line))
    .map((line) => line.replace(/^\d+[.、]\s+/, "").trim())
    .filter(Boolean);
}

function parseTitle(markdown, filePath) {
  const titleLine = markdown
    .split(/\r?\n/)
    .find((line) => /^#\s+/.test(line.trim()));

  if (!titleLine) {
    return path.basename(filePath, ".md");
  }

  return titleLine
    .replace(/^#\s+/, "")
    .replace(/的做法$/, "")
    .replace(/菜谱$/, "")
    .trim();
}

function parseDescription(markdown) {
  const lines = markdown.split(/\r?\n/);
  const paragraphs = [];

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    if (/^##\s+/.test(line)) break;
    if (!line) continue;
    if (line.startsWith("![")) continue;
    if (/^预估烹饪难度/.test(line)) continue;
    if (/^预估卡路里/.test(line)) continue;
    paragraphs.push(line);
  }

  return paragraphs.join("\n");
}

function parseDifficulty(markdown) {
  const match = markdown.match(/预估烹饪难度[：:]\s*([★☆]+)/);
  if (!match) return null;
  return Array.from(match[1]).filter((char) => char === "★").length;
}

function parseCalories(markdown) {
  const match = markdown.match(/预估卡路里[：:]\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseEstimatedTimeMinutes(markdown) {
  const text = markdown.replace(/\s+/g, "");
  const matches = Array.from(text.matchAll(/(\d+)\s*分钟/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (matches.length === 0) return null;
  return Math.max(...matches);
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function inferTags({
  title,
  category,
  description,
  requiredItems,
  steps,
  difficulty,
  calories,
  estimatedTimeMinutes,
}) {
  const text = [
    title,
    category,
    description,
    requiredItems.join(" "),
    steps.join(" "),
  ].join(" ");

  const flavorTags = [];
  const nutritionTags = [];
  const moodTags = [];
  const speedTags = [];

  if (hasAny(text, [/麻辣/, /香辣/, /酸辣/, /辣椒/, /小米辣/, /花椒/, /豆瓣/])) {
    flavorTags.push("spicy");
  }
  if (hasAny(text, [/甜/, /糖/, /蜂蜜/, /奶油/, /蛋糕/, /甜品/, /冰淇淋/])) {
    flavorTags.push("sweet");
  }
  if (hasAny(text, [/酸/, /醋/, /柠檬/, /番茄/, /西红柿/])) {
    flavorTags.push("sour");
  }
  if (hasAny(text, [/清淡/, /清蒸/, /白灼/, /凉拌/, /水煮/, /汤/, /粥/])) {
    flavorTags.push("light");
  }
  if (hasAny(text, [/酱/, /生抽/, /老抽/, /蚝油/, /豆瓣/, /咸香/, /红烧/])) {
    flavorTags.push("savory");
  }

  if (
    category === "vegetable_dish" ||
    hasAny(text, [/青菜/, /生菜/, /菠菜/, /花菜/, /黄瓜/, /西兰花/, /蔬菜/])
  ) {
    nutritionTags.push("vegetableHeavy");
  }
  if (
    hasAny(text, [
      /鸡蛋/,
      /牛肉/,
      /猪肉/,
      /鸡肉/,
      /鱼/,
      /虾/,
      /排骨/,
      /豆腐/,
      /蛋白/,
      /羊肉/,
    ])
  ) {
    nutritionTags.push("highProtein");
  }
  if (calories != null && calories <= 500) nutritionTags.push("lighter");
  if (calories != null && calories >= 1000) nutritionTags.push("highCalorie");

  if (hasAny(text, [/汤/, /粥/, /炖/, /咖喱/, /红烧/, /面/, /饭/])) {
    moodTags.push("comfort");
  }
  if (hasAny(text, [/凉拌/, /清蒸/, /白灼/, /黄瓜/, /柠檬/, /清爽/])) {
    moodTags.push("refreshing");
  }
  if (hasAny(text, [/炸/, /烤/, /芝士/, /奶油/, /蛋糕/, /红烧肉/, /排骨/])) {
    moodTags.push("indulgent");
  }

  if (
    (estimatedTimeMinutes != null && estimatedTimeMinutes <= 20) ||
    hasAny(text, [/快手/, /微波炉/, /空气炸锅/, /简单/])
  ) {
    speedTags.push("quick");
  }
  if (
    (estimatedTimeMinutes != null && estimatedTimeMinutes >= 45) ||
    (difficulty != null && difficulty >= 4)
  ) {
    speedTags.push("slow");
  }
  if (speedTags.length === 0) speedTags.push("normal");

  return {
    flavorTags: Array.from(new Set(flavorTags)),
    nutritionTags: Array.from(new Set(nutritionTags)),
    moodTags: Array.from(new Set(moodTags)),
    speedTags: Array.from(new Set(speedTags)),
  };
}

function parseRecipeFile(filePath) {
  const markdown = fs.readFileSync(filePath, "utf8");
  const recipePath = getRecipePath(filePath);
  const parts = recipePath.split("/");
  const category = parts[1] || "unknown";
  const requiredItems = parseBulletSection(markdown, "必备原料和工具");
  const ingredientKeys = Array.from(
    new Set(requiredItems.flatMap((item) => explodeIngredientKeys(item)))
  );
  const title = parseTitle(markdown, filePath);
  const description = parseDescription(markdown);
  const difficulty = parseDifficulty(markdown);
  const calories = parseCalories(markdown);
  const estimatedTimeMinutes = parseEstimatedTimeMinutes(markdown);
  const steps = parseNumberedSection(markdown, "操作");
  const tags = inferTags({
    title,
    category,
    description,
    requiredItems,
    steps,
    difficulty,
    calories,
    estimatedTimeMinutes,
  });

  return {
    id: slugFromRecipePath(recipePath),
    title,
    category,
    path: recipePath,
    sourcePath: getRelativePath(filePath),
    description,
    difficulty,
    calories,
    estimatedTimeMinutes,
    requiredItems,
    ingredientKeys,
    normalizedTitle: normalizeIngredientName(title),
    ...tags,
    steps,
  };
}

function summarize(recipes, skipped) {
  const categories = recipes.reduce((acc, recipe) => {
    acc[recipe.category] = (acc[recipe.category] || 0) + 1;
    return acc;
  }, {});

  return {
    totalRecipes: recipes.length,
    skippedRecipes: skipped.length,
    categories,
    skipped: skipped.slice(0, 20),
  };
}

function main() {
  const files = walkMarkdownFiles(dishesRoot);
  const skipped = [];
  const recipes = files
    .filter((filePath) => !getRecipePath(filePath).startsWith("dishes/template/"))
    .map(parseRecipeFile)
    .filter((recipe) => {
      if (recipe.requiredItems.length === 0) {
        skipped.push({ path: recipe.path, reason: "missing required items" });
        return false;
      }
      return true;
    });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(recipes, null, 2)}\n`, "utf8");

  const summary = summarize(recipes, skipped);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Wrote ${recipes.length} recipes to ${getRelativePath(outputPath)}`);
}

main();
