import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML_PATH = path.join(ROOT, "public", "atlas.html");
const SOURCE_PATH = path.join(ROOT, "needs-qa-batch-importable.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }

  const header = rows.shift().map((name) => name.replace(/^\uFEFF/u, ""));
  return rows
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] || ""])));
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[^a-z0-9\u0430-\u044f\u0451]+/giu, " ")
    .replace(/\b(national park|nature reserve|reserve|park|sanctuary|biosphere)\b/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function parseLocations(html) {
  const match = html.match(/const locations = (\[[\s\S]*?\n\s*\]);/u);
  if (!match) throw new Error("Could not find locations array.");
  return Function(`return ${match[1]};`)();
}

function existingKeySet(locations) {
  const keys = new Set();
  for (const loc of locations) {
    for (const key of [loc.en, loc.name, loc.wikiEnTitle, loc.wikiRuTitle]) {
      const normalized = normalize(key);
      if (normalized) keys.add(normalized);
    }
  }
  return keys;
}

function assertImportable(row) {
  const validCategories = new Set(["mountain", "forest", "water", "desert", "volcano", "ice_cave"]);
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!row.en || !row.name || !row.country || !row.wikiEnTitle || !row.wikiRuTitle) {
    throw new Error(`Missing text/wiki fields for ${row.sourceName || row.en}`);
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error(`Invalid coordinates for ${row.en}`);
  }
  if (!validCategories.has(row.category)) throw new Error(`Invalid category for ${row.en}`);
}

function actualCategory(row) {
  const hay = [row.typeLabel, row.en, row.name, row.wikiEnTitle, row.wikiRuTitle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    /volcano|geyser|crater|\u0432\u0443\u043b\u043a\u0430\u043d|\u0433\u0435\u0439\u0437\u0435\u0440|\u043a\u0440\u0430\u0442\u0435\u0440/u.test(
      hay,
    )
  )
    return "volcano";
  if (
    /glacier|cave|fjord|\u043b\u0435\u0434\u043d\u0438\u043a|\u043f\u0435\u0449\u0435\u0440|\u0444\u044c\u043e\u0440\u0434/u.test(
      hay,
    )
  )
    return "ice_cave";
  if (
    /desert|canyon|valley|gorge|dune|\u043f\u0443\u0441\u0442\u044b\u043d|\u043a\u0430\u043d\u044c\u043e\u043d|\u0434\u043e\u043b\u0438\u043d|\u0443\u0449\u0435\u043b|\u0434\u044e\u043d/u.test(
      hay,
    )
  )
    return "desert";
  if (
    /forest|national park|nature reserve|protected|\u043b\u0435\u0441|\u043d\u0430\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u0430\u0440\u043a|\u0437\u0430\u043f\u043e\u0432\u0435\u0434|\u043f\u0440\u0438\u0440\u043e\u0434\u043e\u043e\u0445\u0440\u0430\u043d/u.test(
      hay,
    )
  )
    return "forest";
  if (
    /\bmount\b|\bmountain\b|\brange\b|\bpeak\b|\bpass\b|\bplateau\b|\u0433\u043e\u0440\u0430|\u0433\u043e\u0440\u043d|\u043f\u0438\u043a|\u043f\u0435\u0440\u0435\u0432\u0430\u043b|\u043f\u043b\u0430\u0442\u043e|\u0445\u0440\u0435\u0431\u0435\u0442/u.test(
      hay,
    )
  )
    return "mountain";
  if (
    /river|lake|waterfall|island|reef|bay|sea|channel|strait|wetland|\u0440\u0435\u043a\u0430|\u043e\u0437\u0435\u0440|\u043e\u0437\u0451\u0440|\u0432\u043e\u0434\u043e\u043f\u0430\u0434|\u043e\u0441\u0442\u0440\u043e\u0432|\u0440\u0438\u0444|\u0431\u0443\u0445\u0442|\u043c\u043e\u0440\u0435|\u043f\u0440\u043e\u043b\u0438\u0432|\u0431\u043e\u043b\u043e\u0442/u.test(
      hay,
    )
  )
    return "water";
  return row.category;
}

function blockedCandidate(row) {
  const hay = [row.en, row.name, row.wikiEnTitle, row.wikiRuTitle].filter(Boolean).join(" ");
  return /\b(port of benghazi|malwiya|tel hazor|hauran|plain of jars|qacha's nek)\b/iu.test(hay);
}

function q(value) {
  return JSON.stringify(value);
}

function formatLocation(loc) {
  const parts = [
    `name: ${q(loc.name)}`,
    `lat: ${Number(loc.lat)
      .toFixed(6)
      .replace(/\.?0+$/u, "")}`,
    `lng: ${Number(loc.lng)
      .toFixed(6)
      .replace(/\.?0+$/u, "")}`,
    `country: ${q(loc.country)}`,
    `category: ${q(loc.category)}`,
    `en: ${q(loc.en)}`,
    `wikiEnTitle: ${q(loc.wikiEnTitle)}`,
    `wikiRuTitle: ${q(loc.wikiRuTitle)}`,
  ];
  return `  { ${parts.join(", ")} }`;
}

function updateHtml(html, locations) {
  const total = locations.length;
  return html
    .replace(
      /const locations = \[[\s\S]*?\n\s*\];/u,
      [
        "const locations = [",
        `  // Combined Atlas Naturae dataset with salvaged scenic additions: ${total} mapped records.`,
        ...locations.map(
          (loc, index) => `${formatLocation(loc)}${index === locations.length - 1 ? "" : ","}`,
        ),
        "];",
      ].join("\n"),
    )
    .replace(/Atlas Naturae [^"<]* \d+ Wonders/gu, `Atlas Naturae — ${total} Wonders`)
    .replace(
      /Atlas Naturae [^"<]* \d+ \u0447\u0443\u0434\u0435\u0441/gu,
      `Atlas Naturae — ${total} \u0447\u0443\u0434\u0435\u0441`,
    )
    .replace(
      />\s*\d+ \u0427\u0443\u0434\u0435\u0441<br>/u,
      `>${total} \u0427\u0443\u0434\u0435\u0441<br>`,
    )
    .replace(/id="visitedTotal">\d+</u, `id="visitedTotal">${total}<`);
}

const html = fs.readFileSync(HTML_PATH, "utf8");
const rows = parseCsv(fs.readFileSync(SOURCE_PATH, "utf8"));
const sourceKeys = new Set(
  rows
    .flatMap((row) => [row.en, row.name, row.wikiEnTitle, row.wikiRuTitle].map(normalize))
    .filter(Boolean),
);
const originalLocations = parseLocations(html);
const locations = originalLocations.filter((loc) => {
  const locKeys = [loc.en, loc.name, loc.wikiEnTitle, loc.wikiRuTitle]
    .map(normalize)
    .filter(Boolean);
  return !locKeys.some((key) => sourceKeys.has(key));
});
const removed = originalLocations.length - locations.length;
const keys = existingKeySet(locations);
let added = 0;
let skipped = 0;
let blocked = 0;

for (const row of rows) {
  assertImportable(row);
  if (blockedCandidate(row)) {
    blocked += 1;
    continue;
  }
  const rowKeys = [row.en, row.name, row.wikiEnTitle, row.wikiRuTitle]
    .map(normalize)
    .filter(Boolean);
  if (rowKeys.some((key) => keys.has(key))) {
    skipped += 1;
    continue;
  }

  locations.push({
    name: row.name,
    lat: Number(row.lat),
    lng: Number(row.lng),
    country: row.country,
    category: actualCategory(row),
    en: row.en,
    wikiEnTitle: row.wikiEnTitle,
    wikiRuTitle: row.wikiRuTitle,
  });
  for (const key of rowKeys) keys.add(key);
  added += 1;
}

fs.writeFileSync(HTML_PATH, updateHtml(html, locations), "utf8");
console.log(
  JSON.stringify(
    { source: rows.length, removed, added, skipped, blocked, total: locations.length },
    null,
    2,
  ),
);
