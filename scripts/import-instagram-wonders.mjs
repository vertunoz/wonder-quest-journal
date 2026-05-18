import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML_PATH = path.join(ROOT, "public", "atlas.html");
const SOURCE_PATH = process.argv[2] || "C:\\Users\\vertu\\Downloads\\Instagram Wonders.txt";

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9а-яё]+/giu, " ")
    .trim();

function parseJsonArrays(text) {
  const blocks = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "[") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "]") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        blocks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return blocks.flatMap((block) => JSON.parse(block));
}

function parseDisplayName(rawName) {
  const match = rawName.match(/^(.*?)\s*\((.*)\)\s*$/u);
  if (!match) return { name: rawName.trim(), en: rawName.trim() };

  const en = match[1].trim();
  const localized = match[2].trim();
  return {
    name: localized || en,
    en,
  };
}

function wikiTitleFromUrl(url) {
  if (!url) return "";
  const match = url.match(/\/wiki\/(.+)$/u);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]).replace(/_/g, " ");
  } catch {
    return match[1].replace(/_/g, " ");
  }
}

function oldCategoryMap(html) {
  const match = html.match(/const locations = \[([\s\S]*?)\n\];/u);
  if (!match) return new Map();
  const oldLocations = Function(`return [${match[1]}];`)();
  const map = new Map();
  for (const loc of oldLocations) {
    for (const key of [loc.en, loc.name]) {
      const norm = normalize(key);
      if (norm) map.set(norm, loc.category);
    }
  }
  return map;
}

function inferCategory(item, categoryMap) {
  const { name, en } = parseDisplayName(item.name);
  const wikiEnTitle = wikiTitleFromUrl(item.wiki_en);
  const tokens = normalize([item.name, name, en, wikiEnTitle].join(" "));

  if (/вулкан|гейзер|кратер|лава/u.test(tokens)) return "volcano";
  if (/ледник|ледя|пещер|грот|карст/u.test(tokens)) return "ice_cave";
  if (
    /водопад|озер|река|пляж|бухт|залив|лагун|фьорд|остров|источник|побереж|берег|утес/u.test(tokens)
  )
    return "water";
  if (/пустын|каньон|ущель|долин|дюн|солончак|впадин/u.test(tokens)) return "desert";
  if (/лес|парк|заповедник|баобаб|джунгл|роща|сад/u.test(tokens)) return "forest";

  if (
    /\b(volcano|volcanic|geyser|geysir|geothermal|thermal|hot spring|lava|caldera|crater|fumarole|bromo|etna|fuji|kilimanjaro|rinjani|teide|stromboli|cotopaxi|arenal|vesuvius|eyjafjallajokull|dallol|tongariro|вулкан|гейзер|кратер|лава)\b/u.test(
      tokens,
    )
  ) {
    return "volcano";
  }

  if (
    /\b(glacier|ice|iceberg|cave|caves|cavern|caverns|grotto|grot|crystal|karst|ледник|ледя|пещер|грот|карст)\b/u.test(
      tokens,
    )
  ) {
    return "ice_cave";
  }

  if (
    /\b(falls|fall|waterfall|waterfalls|lake|river|beach|bay|lagoon|sea|ocean|reef|island|islands|archipelago|coast|fjord|sound|pool|spring|springs|cenote|sinkhole|blue hole|cliff|cliffs|shore|cape|atoll|palawan|maldives|bora bora|socotra|komodo|raja ampat|водопад|водопады|озер|река|пляж|бухт|залив|лагун|фьорд|остров|источник|побереж|берег|утес|утесы)\b/u.test(
      tokens,
    )
  ) {
    return "water";
  }

  if (
    /\b(desert|canyon|gorge|valley|dune|salar|salt flat|badlands|wadi|mesa|monument valley|wave|pinnacle|pinnacles|sand|erg|depression|danakil|sossusvlei|deadvlei|petrified forest|пустын|каньон|ущель|долин|дюн|солончак|впадин)\b/u.test(
      tokens,
    )
  ) {
    return "desert";
  }

  if (
    /\b(forest|rainforest|jungle|woods|grove|redwood|sequoia|bamboo|baobab|mangrove|garden|park|reserve|sundarbans|amazon|jiuzhaigou|plitvice|лес|парк|заповедник|баобаб|джунгл|роща|сад)\b/u.test(
      tokens,
    )
  ) {
    return "forest";
  }

  for (const key of [en, wikiEnTitle, name, item.name]) {
    const category = categoryMap.get(normalize(key));
    if (category) return category;
  }

  return "mountain";
}

function formatLocation(loc) {
  const fields = [
    `name: ${JSON.stringify(loc.name)}`,
    `lat: ${Number(loc.lat).toFixed(4)}`,
    `lng: ${Number(loc.lng).toFixed(4)}`,
    `country: ${JSON.stringify(loc.country)}`,
    `category: ${JSON.stringify(loc.category)}`,
    `en: ${JSON.stringify(loc.en)}`,
    `wikiEnTitle: ${JSON.stringify(loc.wikiEnTitle)}`,
  ];

  if (loc.wikiRuTitle) fields.push(`wikiRuTitle: ${JSON.stringify(loc.wikiRuTitle)}`);
  fields.push(`tags: ["instagram"]`);

  return `  { ${fields.join(", ")} }`;
}

const html = fs.readFileSync(HTML_PATH, "utf8");
const source = fs.readFileSync(SOURCE_PATH, "utf8");
const categoryMap = oldCategoryMap(html);
const imported = parseJsonArrays(source).map((item) => {
  const display = parseDisplayName(item.name);
  const wikiEnTitle = wikiTitleFromUrl(item.wiki_en) || display.en;
  const wikiRuTitle = wikiTitleFromUrl(item.wiki_ru);

  return {
    ...display,
    country: item.country,
    lat: item.lat,
    lng: item.lng,
    category: inferCategory(item, categoryMap),
    wikiEnTitle,
    wikiRuTitle,
  };
});

const seen = new Set();
const locations = imported.filter((loc) => {
  const key = `${normalize(loc.en)}|${Number(loc.lat).toFixed(3)}|${Number(loc.lng).toFixed(3)}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const counts = locations.reduce((acc, loc) => {
  acc[loc.category] = (acc[loc.category] || 0) + 1;
  return acc;
}, {});

const block = [
  "const locations = [",
  "  // Instagram Wonders import: source file contains 399 unique records.",
  ...locations.map(
    (loc, index) => `${formatLocation(loc)}${index === locations.length - 1 ? "" : ","}`,
  ),
  "];",
].join("\n");

const nextHtml = html.replace(/const locations = \[[\s\S]*?\n\];/u, block);
fs.writeFileSync(HTML_PATH, nextHtml, "utf8");

console.log(`Imported ${locations.length} Instagram wonders from ${SOURCE_PATH}`);
console.log(JSON.stringify(counts, null, 2));
