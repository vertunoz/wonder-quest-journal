import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML_PATH = path.join(ROOT, "public", "atlas.html");
const REPORT_PATH = path.join(ROOT, "dedupe-report.csv");

const MANUAL_ALIAS_GROUPS = [
  ["Annapurna Massif", "Annapurna Base Camp", "Annapurna Sanctuary", "Annapurna"],
  ["Ha Long Bay", "Halong Bay"],
  ["Galápagos Islands", "Galapagos Islands"],
  ["Nærøyfjord", "Naeroyfjord"],
];

const STOP_WORDS = new Set([
  "the",
  "of",
  "and",
  "or",
  "de",
  "du",
  "la",
  "le",
  "el",
  "los",
  "las",
  "national",
  "park",
  "reserve",
  "nature",
  "natural",
  "mount",
  "mt",
  "mountain",
  "mountains",
  "lake",
  "river",
  "island",
  "islands",
  "bay",
  "beach",
  "falls",
  "fall",
  "waterfall",
  "cave",
  "caves",
  "glacier",
  "valley",
  "gorge",
  "canyon",
  "desert",
  "forest",
  "санктуари",
]);

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[^a-z0-9\u0430-\u044f\u0451]+/giu, " ")
    .trim();
}

function parseLocations(html) {
  const match = html.match(/const locations = (\[[\s\S]*?\n\s*\]);/u);
  if (!match) throw new Error("Could not find locations array.");
  return Function(`return ${match[1]};`)();
}

function formatLocation(loc) {
  const fields = [
    `name: ${JSON.stringify(loc.name)}`,
    `lat: ${Number(loc.lat).toFixed(4)}`,
    `lng: ${Number(loc.lng).toFixed(4)}`,
    `country: ${JSON.stringify(loc.country)}`,
    `category: ${JSON.stringify(loc.category)}`,
  ];

  if (loc.en) fields.push(`en: ${JSON.stringify(loc.en)}`);
  if (loc.wikiEnTitle) fields.push(`wikiEnTitle: ${JSON.stringify(loc.wikiEnTitle)}`);
  if (loc.wikiRuTitle) fields.push(`wikiRuTitle: ${JSON.stringify(loc.wikiRuTitle)}`);
  if (loc.tags?.length) fields.push(`tags: ${JSON.stringify(loc.tags)}`);

  return `  { ${fields.join(", ")} }`;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(a, b) {
  const earthRadiusKm = 6371;
  const lat1 = toRad(Number(a.lat));
  const lat2 = toRad(Number(b.lat));
  const dLat = lat2 - lat1;
  const dLng = toRad(Number(b.lng) - Number(a.lng));
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function countryKey(value) {
  return normalize(value)
    .replace(/\b(united states|usa|сша)\b/gu, "usa")
    .replace(/\b(united kingdom|uk|великобритания)\b/gu, "uk")
    .replace(/\b(new zealand|новая зеландия)\b/gu, "new zealand");
}

function sameCountry(a, b) {
  const ca = countryKey(a.country);
  const cb = countryKey(b.country);
  if (!ca || !cb) return false;
  return ca === cb || ca.includes(cb) || cb.includes(ca);
}

function labelKeys(loc) {
  return [loc.en, loc.name].map(normalize).filter(Boolean);
}

function wikiKeys(loc) {
  return [loc.wikiEnTitle, loc.wikiRuTitle].map(normalize).filter(Boolean);
}

function allKeys(loc) {
  return [...new Set([...labelKeys(loc), ...wikiKeys(loc)])];
}

function tokens(loc) {
  return new Set(
    allKeys(loc)
      .join(" ")
      .split(/\s+/u)
      .filter((token) => token.length > 3 && !STOP_WORDS.has(token)),
  );
}

function tokenOverlap(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  let count = 0;
  for (const token of left) {
    if (right.has(token)) count += 1;
  }
  return count;
}

function features(loc) {
  const labels = labelKeys(loc);
  const wiki = wikiKeys(loc);
  const keys = [...new Set([...labels, ...wiki])];
  const tokenSet = new Set(
    keys
      .join(" ")
      .split(/\s+/u)
      .filter((token) => token.length > 3 && !STOP_WORDS.has(token)),
  );
  return { labels, wiki, keys, tokens: tokenSet };
}

function connectedByManualAlias(fa, fb) {
  const keys = new Set([...fa.keys, ...fb.keys]);
  return (
    MANUAL_ALIAS_GROUPS.some((group) => {
      const normalized = group.map(normalize);
      return (
        normalized.some((key) => fa.keys.includes(key)) &&
        normalized.some((key) => fb.keys.includes(key))
      );
    }) && [...keys].some((key) => normalizedManualAliases.has(key))
  );
}

const normalizedManualAliases = new Set(
  MANUAL_ALIAS_GROUPS.flatMap((group) => group.map(normalize)),
);

function isDuplicate(a, b, fa, fb, ia, ib) {
  const distance = distanceKm(a, b);
  const sharedLabel = fa.labels.some((key) => fb.labels.includes(key));
  const sharedAny = fa.keys.some((key) => fb.keys.includes(key));
  let overlap = 0;
  for (const token of fa.tokens) {
    if (fb.tokens.has(token)) overlap += 1;
  }

  const bothOriginal = ia < 431 && ib < 431;
  if (bothOriginal) {
    return sharedLabel && distance <= 3;
  }

  if (connectedByManualAlias(fa, fb) && distance <= 25) return true;
  if (sharedLabel && (sameCountry(a, b) || distance <= 100)) return true;
  if (sharedAny && distance <= 3 && overlap >= 2) return true;
  if (distance <= 0.75 && overlap >= 2) return true;

  return false;
}

function find(parent, value) {
  if (parent[value] !== value) parent[value] = find(parent, parent[value]);
  return parent[value];
}

function union(parent, a, b) {
  const pa = find(parent, a);
  const pb = find(parent, b);
  if (pa !== pb) parent[pb] = pa;
}

function chooseCategory(group) {
  const counts = new Map();
  for (const loc of group) counts.set(loc.category, (counts.get(loc.category) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function mergeGroup(group) {
  const sorted = [...group].sort((a, b) => a.index - b.index);
  const canonical = { ...sorted[0].loc };
  canonical.category = chooseCategory(sorted.map((item) => item.loc));

  for (const { loc } of sorted.slice(1)) {
    if (!canonical.wikiEnTitle && loc.wikiEnTitle) canonical.wikiEnTitle = loc.wikiEnTitle;
    if (!canonical.wikiRuTitle && loc.wikiRuTitle) canonical.wikiRuTitle = loc.wikiRuTitle;
  }

  const tags = new Set();
  for (const { loc } of sorted) {
    for (const tag of loc.tags || []) tags.add(tag);
  }
  if (tags.size) canonical.tags = [...tags];
  else delete canonical.tags;

  return canonical;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const html = fs.readFileSync(HTML_PATH, "utf8");
const locations = parseLocations(html);
const locationFeatures = locations.map(features);
const parent = locations.map((_, index) => index);

for (let i = 0; i < locations.length; i += 1) {
  for (let j = i + 1; j < locations.length; j += 1) {
    if (isDuplicate(locations[i], locations[j], locationFeatures[i], locationFeatures[j], i, j))
      union(parent, i, j);
  }
}

const groups = new Map();
locations.forEach((loc, index) => {
  const root = find(parent, index);
  if (!groups.has(root)) groups.set(root, []);
  groups.get(root).push({ index, loc });
});

const deduped = [];
const report = [
  [
    "kept_index",
    "kept_en",
    "kept_name",
    "removed_index",
    "removed_en",
    "removed_name",
    "removed_tags",
  ],
];

for (const group of groups.values()) {
  if (group.length === 1) {
    deduped.push(group[0].loc);
    continue;
  }

  const merged = mergeGroup(group);
  deduped.push(merged);
  const kept = group.sort((a, b) => a.index - b.index)[0];
  for (const removed of group.slice(1)) {
    report.push([
      kept.index,
      merged.en || "",
      merged.name || "",
      removed.index,
      removed.loc.en || "",
      removed.loc.name || "",
      (removed.loc.tags || []).join("|"),
    ]);
  }
}

const block = [
  "const locations = [",
  `  // Combined Atlas Naturae dataset after duplicate cleanup: ${deduped.length} mapped records.`,
  ...deduped.map(
    (loc, index) => `${formatLocation(loc)}${index === deduped.length - 1 ? "" : ","}`,
  ),
  "];",
].join("\n");

const nextHtml = html
  .replace(/const locations = \[[\s\S]*?\n\s*\];/u, block)
  .replaceAll("1154 Wonders", `${deduped.length} Wonders`)
  .replaceAll("1154 Чудес", `${deduped.length} Чудес`)
  .replace(/id="visitedTotal">1154</u, `id="visitedTotal">${deduped.length}<`);

fs.writeFileSync(HTML_PATH, nextHtml, "utf8");
fs.writeFileSync(
  REPORT_PATH,
  `${report.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      before: locations.length,
      after: deduped.length,
      removed: locations.length - deduped.length,
      duplicateGroups: [...groups.values()].filter((group) => group.length > 1).length,
      report: REPORT_PATH,
    },
    null,
    2,
  ),
);
