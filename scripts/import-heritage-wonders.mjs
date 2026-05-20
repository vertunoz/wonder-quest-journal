import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML_PATH = path.join(ROOT, "public", "atlas.html");
const DEFAULT_SOURCE =
  "C:\\Users\\vertu\\Downloads\\manmade_mixed_heritage_databases_register_enriched_corrected_full_unesco.xlsx";
const SOURCE_PATH = process.argv.find((arg) => arg.endsWith(".xlsx")) || DEFAULT_SOURCE;
const REPORT_PATH = path.join(ROOT, "heritage-import-report.csv");
const UNRESOLVED_PATH = path.join(ROOT, "heritage-wiki-unresolved.csv");
const USER_AGENT = "WonderQuestJournal/1.0 (https://github.com/vertunoz/wonder-quest-journal)";

const PYTHON =
  process.env.PYTHON ||
  "C:\\Users\\vertu\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";

const PY_EXTRACT = String.raw`
import json, sys, openpyxl

path = sys.argv[1]
wb = openpyxl.load_workbook(path, read_only=True, data_only=True)

def rows_for(sheet_name):
    ws = wb[sheet_name]
    rows = ws.iter_rows(values_only=True)
    header = [str(v).strip() if v is not None else "" for v in next(rows)]
    out = []
    for row in rows:
        if not row or not any(v is not None and str(v).strip() for v in row):
            continue
        item = {}
        for i, name in enumerate(header):
            if not name:
                continue
            value = row[i] if i < len(row) else None
            item[name] = value
        out.append(item)
    return out

payload = {
    "unesco": rows_for("UNESCO_cultural_mixed_full"),
    "places": rows_for("Places"),
}
print(json.dumps(payload, ensure_ascii=False, default=str))
`;

const CATEGORY_RULES = [
  [
    "engineering",
    /\b(bridge|canal|railway|railroad|road|aqueduct|water management|hydraulic|industrial|factory|mill|mining|mine|dam|tower|observatory|shipyard|power station|engineering)\b/iu,
  ],
  [
    "sacred",
    /\b(church|cathedral|monastery|temple|mosque|shrine|sanctuary|sacred|abbey|basilica|synagogue|pilgrim|laura|lavra|lumbini|vatican)\b/iu,
  ],
  [
    "fortress",
    /\b(fort|fortress|castle|citadel|military|defen[cs]e|wall|rampart|kremlin|palace)\b/iu,
  ],
  [
    "archaeology",
    /\b(archaeolog|ancient|prehistoric|rock art|ruins|remains|tomb|necropolis|megalith|petra|machu|pyramid|pyramids|valley of the kings|hominid|fossil|cave art|mound|khuttal)\b/iu,
  ],
  ["monument", /\b(memorial|monument|mausoleum|cemeter|statue|memorial sites)\b/iu],
  [
    "city",
    /\b(historic centre|historic center|old city|city|town|urban|medina|quartier|quarter|village|villages|centres|centers|port city|world heritage city)\b/iu,
  ],
];

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[^a-z0-9\u0430-\u044f\u0451]+/giu, " ")
    .replace(
      /\b(the|a|an|and|of|in|at|de|la|le|les|el|al|site|sites|area|areas|cultural|heritage|world|unesco)\b/giu,
      " ",
    )
    .replace(/\s+/gu, " ")
    .trim();
}

function parseLocations(html) {
  const match = html.match(/const locations = (\[[\s\S]*?\n\s*\]);/u);
  if (!match) throw new Error("Could not find locations array.");
  return Function(`return ${match[1]};`)();
}

function existingKeyMap(locations) {
  const map = new Map();
  locations.forEach((loc, index) => {
    for (const key of [loc.en, loc.name, loc.wikiEnTitle, loc.wikiRuTitle, loc.unescoId]) {
      const normalized = normalize(key);
      if (normalized && !map.has(normalized)) map.set(normalized, index);
    }
  });
  return map;
}

function addKeys(map, loc, index) {
  for (const key of [loc.en, loc.name, loc.wikiEnTitle, loc.wikiRuTitle, loc.unescoId]) {
    const normalized = normalize(key);
    if (normalized && !map.has(normalized)) map.set(normalized, index);
  }
}

function validCoord(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

function titleFromWikiUrl(url) {
  const text = String(url || "").trim();
  const match = text.match(/\/wiki\/([^#?]+)/u);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]).replace(/_/gu, " ");
  } catch {
    return match[1].replace(/_/gu, " ");
  }
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  return Number(String(value).replace(",", "."));
}

function inferCategory(text, kind) {
  if (kind === "mixed") return "mixed_landscape";
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  return "architecture";
}

function sourceTags(source, type, category) {
  const hay = `${source || ""} ${type || ""} ${category || ""}`.toLowerCase();
  const tags = [];
  if (hay.includes("unesco") || hay.includes("world heritage")) tags.push("unesco");
  if (hay.includes("new7wonders of the world")) tags.push("new7world");
  if (hay.includes("new7wonders cities")) tags.push("new7city");
  if (hay.includes("ancient world")) tags.push("ancient7");
  if (hay.includes("modern world") || hay.includes("asce")) tags.push("engineering7");
  if (hay.includes("industrial world")) tags.push("industrial7");
  if (hay.includes("endangered") || hay.includes("world monuments watch")) tags.push("endangered");
  if (hay.includes("organization of world heritage cities")) tags.push("heritage_city");
  return tags;
}

function mergeTags(current, next) {
  return [...new Set([...(current || []), ...next].filter(Boolean))];
}

function makeUnescoRow(row) {
  const lat = toNumber(row.Latitude);
  const lng = toNumber(row.Longitude);
  const category = String(row.Category || "").toLowerCase();
  const kind = category === "mixed" ? "mixed" : "human";
  const text = `${row["Site name (EN)"] || ""} ${row["Site name (RU)"] || ""} ${row.Criteria || ""}`;
  const tags = ["unesco"];
  if (row["Danger list"] && String(row["Danger list"]) !== "0") tags.push("endangered");
  return {
    source: "unesco_full",
    name: row["Site name (RU)"] || row["Site name (EN)"],
    en: row["Site name (EN)"],
    country: row["Country / States"],
    lat,
    lng,
    kind,
    category: inferCategory(text, kind),
    wikiEnTitle: titleFromWikiUrl(row["Wikipedia candidate URL"]) || row["Site name (EN)"],
    wikiRuTitle: row["Site name (RU)"] || "",
    unescoId: row["UNESCO ID"] ? String(row["UNESCO ID"]) : "",
    tags,
  };
}

function makePlaceRow(row) {
  const lat = toNumber(row.Latitude);
  const lng = toNumber(row.Longitude);
  const type = String(row.Type || "");
  const source = String(row["Source / ranking"] || "");
  const kind = /mixed/iu.test(type) ? "mixed" : "human";
  const text = `${row["Place / object name"] || ""} ${row["Country / region"] || ""} ${type} ${source}`;
  return {
    source: "places",
    name: row["Place / object name"],
    en: row["Place / object name"],
    country: row["Country / region"],
    lat,
    lng,
    kind,
    category: inferCategory(text, kind),
    wikiEnTitle:
      titleFromWikiUrl(row["Suggested Wikipedia page URL"]) || row["Place / object name"],
    wikiRuTitle: "",
    unescoId: "",
    tags: sourceTags(source, type, ""),
  };
}

function readWorkbook() {
  const raw = execFileSync(PYTHON, ["-c", PY_EXTRACT, SOURCE_PATH], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  return JSON.parse(raw);
}

async function fetchWikiBatch(titles) {
  const params = new URLSearchParams({
    action: "query",
    titles: titles.join("|"),
    redirects: "1",
    prop: "langlinks|pageimages",
    lllang: "ru",
    lllimit: "1",
    piprop: "name|thumbnail",
    pithumbsize: "900",
    format: "json",
    origin: "*",
  });
  const res = await fetch("https://en.wikipedia.org/w/api.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": USER_AGENT,
    },
    body: params,
  });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  const json = await res.json();
  const normalized = new Map((json.query?.normalized || []).map((item) => [item.from, item.to]));
  const redirects = new Map((json.query?.redirects || []).map((item) => [item.from, item.to]));
  const pages = Object.values(json.query?.pages || {});
  const byTitle = new Map();
  for (const page of pages) {
    if (page.missing !== undefined) continue;
    byTitle.set(page.title, {
      title: page.title,
      wikiRuTitle: page.langlinks?.[0]?.["*"] || "",
      image: page.thumbnail?.source || "",
    });
  }
  const result = new Map();
  for (const title of titles) {
    const normalizedTitle = normalized.get(title) || title;
    const redirectedTitle =
      redirects.get(normalizedTitle) || redirects.get(title) || normalizedTitle;
    const data = byTitle.get(redirectedTitle) || byTitle.get(normalizedTitle);
    if (data) result.set(title, data);
  }
  return result;
}

async function enrichWiki(rows) {
  const unique = [...new Set(rows.map((row) => row.wikiEnTitle).filter(Boolean))];
  const resolved = new Map();
  const unresolved = [];
  for (let i = 0; i < unique.length; i += 45) {
    const chunk = unique.slice(i, i + 45);
    try {
      const data = await fetchWikiBatch(chunk);
      for (const title of chunk) {
        if (data.has(title)) resolved.set(title, data.get(title));
        else unresolved.push({ title, note: "not found in en.wikipedia batch" });
      }
    } catch (error) {
      for (const title of chunk) unresolved.push({ title, note: error.message });
    }
    if (i + 45 < unique.length) await sleep(120);
  }
  for (const row of rows) {
    const wiki = resolved.get(row.wikiEnTitle);
    if (!wiki) continue;
    row.wikiEnTitle = wiki.title || row.wikiEnTitle;
    if (!row.wikiRuTitle && wiki.wikiRuTitle) row.wikiRuTitle = wiki.wikiRuTitle;
    if (wiki.image) row.image = wiki.image;
  }
  return unresolved;
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
    `kind: ${q(loc.kind || "natural")}`,
    `en: ${q(loc.en)}`,
  ];
  if (loc.wikiEnTitle) parts.push(`wikiEnTitle: ${q(loc.wikiEnTitle)}`);
  if (loc.wikiRuTitle) parts.push(`wikiRuTitle: ${q(loc.wikiRuTitle)}`);
  if (loc.tags?.length) parts.push(`tags: ${q(loc.tags)}`);
  if (loc.unescoId) parts.push(`unescoId: ${q(loc.unescoId)}`);
  if (loc.image) parts.push(`image: ${q(loc.image)}`);
  return `  { ${parts.join(", ")} }`;
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
    .replace(/Atlas Naturae [^"<]* \d+ Wonders/gu, `World Wonders Atlas — ${total} Wonders`)
    .replace(
      /Atlas Naturae [^"<]* \d+ \u0447\u0443\u0434\u0435\u0441/gu,
      `World Wonders Atlas — ${total} \u0447\u0443\u0434\u0435\u0441`,
    )
    .replace(
      />\s*\d+ \u0427\u0443\u0434\u0435\u0441<br>/u,
      `>${total} \u0447\u0443\u0434\u0435\u0441<br>`,
    )
    .replace(/id="visitedTotal">\d+</u, `id="visitedTotal">${total}<`);
}

function writeCsv(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(file, "\uFEFF", "utf8");
    return;
  }
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const esc = (value) => {
    const text = String(value ?? "");
    return /[",\n\r]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
  };
  fs.writeFileSync(
    file,
    "\uFEFF" +
      [headers.join(","), ...rows.map((row) => headers.map((h) => esc(row[h])).join(","))].join(
        "\n",
      ) +
      "\n",
    "utf8",
  );
}

const workbook = readWorkbook();
const html = fs.readFileSync(HTML_PATH, "utf8");
const locations = parseLocations(html).map((loc) => ({
  ...loc,
  kind: loc.kind || "natural",
}));

const sourceRows = [
  ...workbook.unesco.map(makeUnescoRow),
  ...workbook.places.map(makePlaceRow),
].filter((row) => row.en && row.name && row.country && validCoord(row.lat, row.lng));

const wikiUnresolved = await enrichWiki(sourceRows);
const keyMap = existingKeyMap(locations);
const report = [];
let added = 0;
let updated = 0;

for (const row of sourceRows) {
  const keys = [row.unescoId, row.en, row.name, row.wikiEnTitle, row.wikiRuTitle]
    .map(normalize)
    .filter(Boolean);
  const existingIndex = keys.map((key) => keyMap.get(key)).find((index) => index !== undefined);
  if (existingIndex !== undefined) {
    const loc = locations[existingIndex];
    loc.tags = mergeTags(loc.tags, row.tags);
    if (row.kind === "mixed" || (row.kind === "human" && loc.kind !== "mixed")) loc.kind = row.kind;
    if (loc.kind !== "natural") loc.category = row.category;
    loc.wikiEnTitle = loc.wikiEnTitle || row.wikiEnTitle;
    loc.wikiRuTitle = loc.wikiRuTitle || row.wikiRuTitle;
    loc.unescoId = loc.unescoId || row.unescoId;
    loc.image = loc.image || row.image;
    updated += 1;
    report.push({
      action: "updated",
      en: row.en,
      name: row.name,
      kind: row.kind,
      category: row.category,
      source: row.source,
    });
    addKeys(keyMap, loc, existingIndex);
    continue;
  }
  const loc = {
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    country: row.country,
    category: row.category,
    kind: row.kind,
    en: row.en,
    wikiEnTitle: row.wikiEnTitle,
    wikiRuTitle: row.wikiRuTitle,
    tags: row.tags,
    unescoId: row.unescoId,
    image: row.image,
  };
  locations.push(loc);
  addKeys(keyMap, loc, locations.length - 1);
  added += 1;
  report.push({
    action: "added",
    en: row.en,
    name: row.name,
    kind: row.kind,
    category: row.category,
    source: row.source,
  });
}

fs.writeFileSync(HTML_PATH, updateHtml(html, locations), "utf8");
writeCsv(REPORT_PATH, report);
writeCsv(UNRESOLVED_PATH, wikiUnresolved);

console.log(
  JSON.stringify(
    {
      sourceRows: sourceRows.length,
      added,
      updated,
      total: locations.length,
      wikiUnresolved: wikiUnresolved.length,
      report: REPORT_PATH,
      unresolved: UNRESOLVED_PATH,
    },
    null,
    2,
  ),
);
