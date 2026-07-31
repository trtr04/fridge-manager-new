import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const mappingPath = path.join(__dirname, "howToCookEnglishMap.json");
const outputPath = path.join(
  projectRoot,
  "src",
  "data",
  "howToCookEnglish.json"
);
const sourceRoot = process.argv[2];

if (!sourceRoot) {
  throw new Error(
    "Usage: node scripts/importHowToCookEnglish.js /path/to/HowToCookWithEnglish/translation/en/dishes"
  );
}

const mappingDocument = JSON.parse(fs.readFileSync(mappingPath, "utf8"));

function normalizeHeading(line) {
  return line.replace(/^#+\s*/, "").trim().toLowerCase();
}

function extractSections(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const target = heading.toLowerCase();
  const sections = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (normalizeHeading(lines[index]) !== target) continue;

    const section = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^##/.test(lines[cursor].trim())) break;
      section.push(lines[cursor]);
    }
    sections.push(section);
  }

  return sections;
}

function cleanListItem(line) {
  return line
    .replace(/^\s*(?:[-*+]|\d+[.)])\s*/, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseListSections(markdown, heading) {
  return extractSections(markdown, heading)
    .flatMap((section) =>
      section
        .map((line) => line.trim())
        .filter((line) => /^(?:[-*+]|\d+[.)])\s*/.test(line))
        .map(cleanListItem)
    )
    .filter(Boolean);
}

function parseDescription(markdown) {
  const lines = markdown.split(/\r?\n/);
  const paragraphs = [];

  for (const rawLine of lines.slice(1)) {
    const line = rawLine
      .replace(/!\s*\[[^\]]*]\s*\([^)]+\)/g, "")
      .trim();
    if (/^##/.test(line)) break;
    if (!line) continue;
    if (/^estimated (?:cooking difficulty|calories)/i.test(line)) continue;
    paragraphs.push(line);
  }

  return paragraphs.join("\n");
}

function parseEnglishRecipe(filePath, relativePath) {
  const markdown = fs.readFileSync(filePath, "utf8");
  const title = path.basename(filePath, ".md").trim();

  return {
    title,
    description: parseDescription(markdown),
    requiredItems: parseListSections(
      markdown,
      "Essential materials and tools"
    ),
    steps: parseListSections(markdown, "Operation"),
    sourcePath: relativePath.split(path.sep).join("/"),
    sourceUrl: `https://github.com/EuropaSuperman/HowToCookWithEnglish/blob/${mappingDocument.source.commit}/translation/en/dishes/${relativePath
      .split(path.sep)
      .map(encodeURIComponent)
      .join("/")}`,
  };
}

const recipes = {};
const missingFiles = [];

for (const [recipeId, relativePath] of Object.entries(
  mappingDocument.recipes
)) {
  const filePath = path.join(sourceRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    missingFiles.push(relativePath);
    continue;
  }
  recipes[recipeId] = parseEnglishRecipe(filePath, relativePath);
}

if (missingFiles.length > 0) {
  throw new Error(
    `Missing ${missingFiles.length} mapped English recipe files:\n${missingFiles
      .slice(0, 20)
      .join("\n")}`
  );
}

const output = {
  source: mappingDocument.source,
  recipes,
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      outputPath,
      importedRecipes: Object.keys(recipes).length,
    },
    null,
    2
  )
);
