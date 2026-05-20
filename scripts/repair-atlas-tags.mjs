import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML_PATH = path.join(ROOT, "public", "atlas.html");
const LEGACY_REVISIONS = ["a111b85", "65f36e6"];

const MISSING_WONDERS = [
  {
    name: "Христос-Искупитель",
    lat: -22.9519,
    lng: -43.2105,
    country: "Бразилия",
    category: "monument",
    kind: "human",
    en: "Christ the Redeemer",
    wikiEnTitle: "Christ the Redeemer (statue)",
    wikiRuTitle: "Статуя Христа-Искупителя",
    tags: ["new7world"],
  },
  {
    name: "Северное сияние",
    lat: 64.9631,
    lng: -19.0208,
    country: "Арктика / высокие широты",
    category: "ice_cave",
    kind: "natural",
    en: "Aurora Borealis",
    wikiEnTitle: "Aurora",
    wikiRuTitle: "Полярное сияние",
    tags: ["7nat"],
  },
  {
    name: "Вулкан Парикутин",
    lat: 19.4936,
    lng: -102.2514,
    country: "Мексика",
    category: "volcano",
    kind: "natural",
    en: "Parícutin",
    wikiEnTitle: "Parícutin",
    wikiRuTitle: "Парикутин",
    tags: ["7nat"],
  },
  {
    name: "Бухта Рио-де-Жанейро",
    lat: -22.82,
    lng: -43.17,
    country: "Бразилия",
    category: "water",
    kind: "natural",
    en: "Harbor of Rio de Janeiro",
    wikiEnTitle: "Guanabara Bay",
    wikiRuTitle: "Гуанабара",
    tags: ["7nat"],
  },
];

const EXACT_TAG_SETS = {
  "7nat": [
    "Aurora Borealis",
    "Grand Canyon",
    "Great Barrier Reef",
    "Harbor of Rio de Janeiro",
    "Mount Everest",
    "Parícutin",
    "Victoria Falls",
  ],
  new7: [
    "Amazon rainforest",
    "Ha Long Bay",
    "Iguazu Falls",
    "Jeju Island",
    "Komodo National Park",
    "Puerto Princesa Subterranean River National Park",
    "Table Mountain",
  ],
  new7world: [
    "The Great Wall",
    "Petra",
    "Colosseum",
    "Pre-Hispanic City of Chichen-Itza",
    "Taj Mahal",
    "Machu Picchu",
    "Christ the Redeemer",
  ],
  new7city: [
    "Beirut",
    "Doha",
    "Durban",
    "Havana",
    "Kuala Lumpur",
    "La Paz",
    "Historic City of Vigan",
  ],
};

function parseLocations(html) {
  const match = html.match(/const locations = (\[[\s\S]*?\n\s*\]);/u);
  if (!match) throw new Error("Could not find locations array.");
  return Function(`return ${match[1]};`)();
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[^a-z0-9а-яё]+/giu, " ")
    .replace(/\b(the|a|an|of|and|de|la|le|el|los|las|san|santa|saint|st)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function q(value) {
  return JSON.stringify(value);
}

function formatLocation(loc) {
  const parts = [
    `name: ${q(loc.name)}`,
    `lat: ${Number(loc.lat)}`,
    `lng: ${Number(loc.lng)}`,
    `country: ${q(loc.country)}`,
    `category: ${q(loc.category)}`,
    `kind: ${q(loc.kind || "natural")}`,
    `en: ${q(loc.en)}`,
  ];
  if (loc.wikiEnTitle) parts.push(`wikiEnTitle: ${q(loc.wikiEnTitle)}`);
  if (loc.wikiRuTitle) parts.push(`wikiRuTitle: ${q(loc.wikiRuTitle)}`);
  if (Array.isArray(loc.tags) && loc.tags.length) parts.push(`tags: ${q(loc.tags)}`);
  if (loc.unescoId) parts.push(`unescoId: ${q(loc.unescoId)}`);
  if (loc.image) parts.push(`image: ${q(loc.image)}`);
  return `  { ${parts.join(", ")} }`;
}

function addKeys(map, loc, index) {
  for (const key of [loc.en, loc.name, loc.wikiEnTitle, loc.wikiRuTitle]) {
    const normalized = normalize(key);
    if (normalized && !map.has(normalized)) map.set(normalized, index);
  }
}

function mergeTags(existing, incoming) {
  return [...new Set([...(existing || []), ...(incoming || [])])];
}

function restoreLegacyTags(locations, keyMap) {
  let restored = 0;
  for (const rev of LEGACY_REVISIONS) {
    const html = execFileSync("git", ["show", `${rev}:public/atlas.html`], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 50_000_000,
    });
    for (const oldLoc of parseLocations(html)) {
      if (!oldLoc.tags?.length) continue;
      const keys = [oldLoc.en, oldLoc.name, oldLoc.wikiEnTitle, oldLoc.wikiRuTitle]
        .map(normalize)
        .filter(Boolean);
      const index = keys.map((key) => keyMap.get(key)).find((value) => value !== undefined);
      if (index === undefined) continue;
      const before = (locations[index].tags || []).length;
      locations[index].tags = mergeTags(locations[index].tags, oldLoc.tags);
      if (locations[index].tags.length !== before) restored += 1;
    }
  }
  return restored;
}

function ensureMissingWonders(locations, keyMap) {
  let added = 0;
  for (const wonder of MISSING_WONDERS) {
    const key = normalize(wonder.en);
    if (keyMap.has(key)) {
      const loc = locations[keyMap.get(key)];
      loc.tags = mergeTags(loc.tags, wonder.tags);
      continue;
    }
    locations.push({ ...wonder });
    addKeys(keyMap, wonder, locations.length - 1);
    added += 1;
  }
  return added;
}

function applyExactSets(locations) {
  for (const tag of Object.keys(EXACT_TAG_SETS)) {
    for (const loc of locations) {
      loc.tags = (loc.tags || []).filter((item) => item !== tag);
    }
    for (const en of EXACT_TAG_SETS[tag]) {
      const loc = locations.find((item) => normalize(item.en) === normalize(en));
      if (loc) loc.tags = mergeTags(loc.tags, [tag]);
    }
  }
}

function updateHtml(html, locations) {
  const total = locations.length;
  return html
    .replace(
      /const locations = \[[\s\S]*?\n\s*\];/u,
      [
        "const locations = [",
        `  // Combined World Wonders Atlas dataset: ${total} mapped records.`,
        ...locations.map(
          (loc, index) => `${formatLocation(loc)}${index === locations.length - 1 ? "" : ","}`,
        ),
        "];",
      ].join("\n"),
    )
    .replace(/World Wonders Atlas — \d+ Wonders/gu, `World Wonders Atlas — ${total} Wonders`)
    .replace(/World Wonders Atlas — \d+ чудес/gu, `World Wonders Atlas — ${total} чудес`)
    .replace(/>\d+ чудес<br>/u, `>${total} чудес<br>`)
    .replace(/id="visitedTotal">\d+</u, `id="visitedTotal">${total}<`);
}

const html = fs.readFileSync(HTML_PATH, "utf8");
const locations = parseLocations(html);
const keyMap = new Map();
locations.forEach((loc, index) => addKeys(keyMap, loc, index));

const restored = restoreLegacyTags(locations, keyMap);
const added = ensureMissingWonders(locations, keyMap);
applyExactSets(locations);

fs.writeFileSync(HTML_PATH, updateHtml(html, locations), "utf8");

const counts = {};
for (const loc of locations) for (const tag of loc.tags || []) counts[tag] = (counts[tag] || 0) + 1;
console.log(JSON.stringify({ total: locations.length, restored, added, counts }, null, 2));
