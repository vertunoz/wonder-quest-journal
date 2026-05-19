import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML_PATH = path.join(ROOT, "public", "atlas.html");
const SOURCE_PATH =
  process.argv[2] ||
  "C:\\Users\\vertu\\Downloads\\new-natural-scenic-additions_unique_all_coords_wikipedia_filled.csv";
const REPORT_PATH = path.join(ROOT, "scenic-import-report.csv");
const USER_AGENT = "WonderQuestJournal/1.0 (https://github.com/vertunoz/wonder-quest-journal)";

const CATEGORY_MAP = new Map([
  ["Waters and Coasts", "water"],
  ["Mountains and Rocks", "mountain"],
  ["Forests and Parks", "forest"],
  ["Deserts and Canyons", "desert"],
  ["Volcanoes and Geysers", "volcano"],
  ["Ice and Caves", "ice_cave"],
]);

const MANUAL_OVERRIDES = {
  "Theth National Park": { name: "Национальный парк Тети" },
  "Ahaggar Mountains": { country: "Algeria", countryRu: "Алжир" },
  "Barbuda Pink Sand Beach": { name: "Розовый пляж Барбуды" },
  "Esteros del Iber\u00e1": {
    name: "\u042d\u0441\u0442\u0435\u0440\u043e\u0441-\u0434\u0435\u043b\u044c-\u0418\u0431\u0435\u0440\u0430",
  },
  "Blue Lake Mount Gambier": { name: "Голубое озеро Маунт-Гамбир" },
  "Gobustan Mud Volcanoes": { name: "Грязевые вулканы Гобустана" },
  "Fundy National Park": { name: "Национальный парк Фанди" },
  "Auyuittuq National Park": { name: "Национальный парк Ауюиттук" },
  "Chutes de Boali": {
    name: "\u0412\u043e\u0434\u043e\u043f\u0430\u0434\u044b \u0411\u043e\u0430\u043b\u0438",
    country: "Central African Republic",
    countryRu:
      "\u0426\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\u043e\u0430\u0444\u0440\u0438\u043a\u0430\u043d\u0441\u043a\u0430\u044f \u0420\u0435\u0441\u043f\u0443\u0431\u043b\u0438\u043a\u0430",
  },
  "Hailuogou Glacier Park": {
    name: "\u041b\u0435\u0434\u043d\u0438\u043a\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043a \u0425\u0430\u0439\u043b\u0443\u043e\u0433\u043e\u0443",
    country: "China",
    countryRu: "\u041a\u0438\u0442\u0430\u0439",
  },
  "Ennedi Plateau": { name: "Плато Эннеди" },
  "Three Gorges of the Yangtze": { name: "Три ущелья Янцзы" },
  "Seven Sisters Waterfall Grenada": {
    name: "\u0412\u043e\u0434\u043e\u043f\u0430\u0434\u044b \u00ab\u0421\u0435\u043c\u044c \u0441\u0435\u0441\u0442\u0451\u0440\u00bb (\u0413\u0440\u0435\u043d\u0430\u0434\u0430)",
    country: "Grenada",
    countryRu: "\u0413\u0440\u0435\u043d\u0430\u0434\u0430",
  },
  "Bassin Bleu": { name: "\u0411\u0430\u0441\u0441\u0435\u043d-\u0411\u043b\u0451" },
  "Hornstrandir Nature Reserve": { name: "Хорнстрандир" },
  "Dzukou Valley": {
    name: "\u0414\u043e\u043b\u0438\u043d\u0430 \u0414\u0437\u044e\u043a\u043e\u0443",
  },
  "Hormuz Island Rainbow Valley": { name: "Радужная долина острова Ормуз" },
  "Hawraman Mountains": {
    name: "\u0413\u043e\u0440\u044b \u0425\u0430\u0432\u0440\u0430\u043c\u0430\u043d",
  },
  "Gap of Dunloe": { name: "\u0413\u044d\u043f-\u043e\u0444-\u0414\u0430\u043d\u043b\u043e\u0443" },
  "Monti Sibillini National Park": {
    name: "\u041d\u0430\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u0430\u0440\u043a \u041c\u043e\u043d\u0442\u0438-\u0421\u0438\u0431\u0438\u043b\u043b\u0438\u043d\u0438",
  },
  "Shiretoko Five Lakes": {
    name: "\u041f\u044f\u0442\u044c \u043e\u0437\u0451\u0440 \u0421\u0438\u0440\u044d\u0442\u043e\u043a\u043e",
    country: "Japan",
    countryRu: "\u042f\u043f\u043e\u043d\u0438\u044f",
  },
  "Iya Valley": { name: "\u0414\u043e\u043b\u0438\u043d\u0430 \u0418\u044f" },
  "Wadi Mujib": { name: "Вади-Муджиб" },
  "Millennium Island": { name: "Остров Миллениум" },
  "Germia Park": { name: "\u041f\u0430\u0440\u043a \u0413\u0435\u0440\u043c\u0438\u044f" },
  "Al Shaheed Park Natural Zone": {
    name: "\u041f\u0440\u0438\u0440\u043e\u0434\u043d\u0430\u044f \u0437\u043e\u043d\u0430 \u043f\u0430\u0440\u043a\u0430 \u0410\u043b\u044c-\u0428\u0430\u0445\u0438\u0434",
  },
  "Ubari Lakes": {
    name: "\u041e\u0437\u0451\u0440\u0430 \u0423\u0431\u0430\u0440\u0438",
    country: "Libya",
    countryRu: "\u041b\u0438\u0432\u0438\u044f",
  },
  "M\u00fcllerthal Trail": { name: "Тропа Мюллерталь" },
  "\u0160ar Mountains National Park": { name: "Национальный парк Шар-Планина" },
  "Ankarana Special Reserve": {
    name: "\u0421\u043f\u0435\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439 \u0437\u0430\u043f\u043e\u0432\u0435\u0434\u043d\u0438\u043a \u0410\u043d\u043a\u0430\u0440\u0430\u043d\u0430",
  },
  "Tsingy Rouge": {
    name: "\u041a\u0440\u0430\u0441\u043d\u044b\u0435 \u0446\u0438\u043d\u0433\u0438",
  },
  "Blue Hole Malta": {
    name: "\u0413\u043e\u043b\u0443\u0431\u0430\u044f \u0434\u044b\u0440\u0430 (\u041c\u0430\u043b\u044c\u0442\u0430)",
    country: "Malta",
    countryRu: "\u041c\u0430\u043b\u044c\u0442\u0430",
  },
  "Todra Gorge": { name: "\u0423\u0449\u0435\u043b\u044c\u0435 \u0422\u043e\u0434\u0440\u0430" },
  "Addu Atoll": { name: "Атолл Адду" },
  "Orheiul Vechi Landscape": { name: "Ландшафт Старый Орхей" },
  "Saba Marine Park": {
    name: "\u041c\u043e\u0440\u0441\u043a\u043e\u0439 \u043f\u0430\u0440\u043a \u0421\u0430\u0431\u0430",
    country: "Netherlands",
    countryRu: "\u041d\u0438\u0434\u0435\u0440\u043b\u0430\u043d\u0434\u044b",
  },
  "Cross River National Park": {
    name: "\u041d\u0430\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u0430\u0440\u043a \u041a\u0440\u043e\u0441\u0441-\u0420\u0438\u0432\u0435\u0440",
  },
  "Wadi Bani Khalid": {
    name: "\u0412\u0430\u0434\u0438-\u0411\u0430\u043d\u0438-\u0425\u0430\u043b\u0438\u0434",
  },
  "Jebel Shams": { name: "Джебель-Шамс" },
  "Ngerukewid Islands Wildlife Preserve": {
    name: "\u0417\u0430\u043f\u043e\u0432\u0435\u0434\u043d\u0438\u043a \u043e\u0441\u0442\u0440\u043e\u0432\u043e\u0432 \u041d\u0433\u0435\u0440\u0443\u043a\u0435\u0432\u0438\u0434",
    country: "Palau",
    countryRu: "\u041f\u0430\u043b\u0430\u0443",
  },
  "Tufi Fjords": { name: "\u0424\u044c\u043e\u0440\u0434\u044b \u0422\u0443\u0444\u0438" },
  "Peneda-Ger\u00eas National Park": { name: "Национальный парк Пенеда-Жереш" },
  "Fajardo Bioluminescent Bay": {
    name: "\u0411\u0438\u043e\u043b\u044e\u043c\u0438\u043d\u0435\u0441\u0446\u0435\u043d\u0442\u043d\u0430\u044f \u0431\u0443\u0445\u0442\u0430 \u0424\u0430\u0445\u0430\u0440\u0434\u043e",
    country: "Puerto Rico",
    countryRu: "\u041f\u0443\u044d\u0440\u0442\u043e-\u0420\u0438\u043a\u043e",
  },
  "Pigeon Island National Park": {
    name: "\u041d\u0430\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u0430\u0440\u043a \u041f\u0438\u0434\u0436\u0435\u043d-\u0410\u0439\u043b\u0435\u043d\u0434",
    country: "Saint Lucia",
    countryRu: "\u0421\u0435\u043d\u0442-\u041b\u044e\u0441\u0438\u044f",
  },
  "Taganay National Park": {
    name: "Национальный парк Таганай",
    country: "Russia",
    countryRu: "Россия",
  },
  "Nyungwe Forest National Park": { name: "Национальный парк Ньюнгве" },
  "Al Wahbah Crater": {
    name: "\u041a\u0440\u0430\u0442\u0435\u0440 \u0410\u043b\u044c-\u0412\u0430\u0445\u0431\u0430",
  },
  "Uvac Canyon": { name: "Каньон Увац" },
  "Tara National Park": { name: "Национальный парк Тара" },
  "Cabo de Gata-N\u00edjar Natural Park": {
    name: "\u041f\u0440\u0438\u0440\u043e\u0434\u043d\u044b\u0439 \u043f\u0430\u0440\u043a \u041a\u0430\u0431\u043e-\u0434\u0435-\u0413\u0430\u0442\u0430-\u041d\u0438\u0445\u0430\u0440",
  },
  "Fazao-Malfakassa National Park": {
    name: "\u041d\u0430\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u0430\u0440\u043a \u0424\u0430\u0437\u0430\u043e-\u041c\u0430\u043b\u044c\u0444\u0430\u043a\u0430\u0441\u0441\u0430",
  },
  "Mapu\u02bba Vaea Blowholes": {
    name: "\u0411\u043b\u043e\u0443\u0445\u043e\u043b\u044b \u041c\u0430\u043f\u0443\u0430-\u0430-\u0412\u0430\u0435\u0430",
    country: "Tonga",
    countryRu: "\u0422\u043e\u043d\u0433\u0430",
  },
  "K\u00f6w Ata Underground Lake": {
    name: "\u041f\u043e\u0434\u0437\u0435\u043c\u043d\u043e\u0435 \u043e\u0437\u0435\u0440\u043e \u041a\u043e\u0432-\u0410\u0442\u0430",
    country: "Turkmenistan",
    countryRu: "\u0422\u0443\u0440\u043a\u043c\u0435\u043d\u0438\u0441\u0442\u0430\u043d",
  },
  "Kungsleden Trail Landscapes": { name: "Тропа Кунгследен" },
  "Canyonlands Needles District": { name: "Район Нидлс в Каньонлендс" },
  "Mount Baker Wilderness": {
    name: "\u0414\u0438\u043a\u0430\u044f \u0442\u0435\u0440\u0440\u0438\u0442\u043e\u0440\u0438\u044f \u041c\u0430\u0443\u043d\u0442-\u0411\u0435\u0439\u043a\u0435\u0440",
  },
  "Al Mahrah Coast": { name: "Побережье Эль-Махры" },
  "Matobo Hills": { name: "Холмы Матобо" },
};

function normalizeCountryLabel(value) {
  return (
    {
      "People's Republic of China": "China",
      "United States of America": "United States",
    }[value] || value
  );
}

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

function buildKeyMap(locations) {
  const map = new Map();
  locations.forEach((loc, index) => {
    for (const key of [loc.en, loc.name, loc.wikiEnTitle, loc.wikiRuTitle]) {
      const normalized = normalize(key);
      if (normalized && !map.has(normalized)) map.set(normalized, index);
    }
  });
  return map;
}

function validCoordinates(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function inferCategory(row) {
  const mapped = CATEGORY_MAP.get(row.Category);
  if (mapped) return mapped;

  const text = normalize(
    [row["English name"], row.Category, row.Tags, row["Wikipedia EN"]].join(" "),
  );
  if (/\b(volcano|geyser|geothermal|caldera|crater|lava|mud volcano)\b/u.test(text))
    return "volcano";
  if (/\b(glacier|ice|cave|cavern|karst|fjord)\b/u.test(text)) return "ice_cave";
  if (/\b(falls|lake|river|beach|bay|lagoon|reef|island|coast|atoll|wetland|delta)\b/u.test(text))
    return "water";
  if (/\b(desert|canyon|gorge|dune|valley|wadi|badlands|salt)\b/u.test(text)) return "desert";
  if (/\b(forest|rainforest|jungle|woods|grove|park|reserve|sanctuary)\b/u.test(text))
    return "forest";
  return "mountain";
}

function tagsFromCsv(value) {
  const raw = String(value || "").toLowerCase();
  const tags = [];
  if (raw.includes("unesco")) tags.push("unesco");
  if (raw.includes("extreme")) tags.push("extreme");
  if (raw.includes("underrated")) tags.push("underrated");
  return tags;
}

function addTags(loc, tags) {
  if (!tags.length) return;
  loc.tags = [...new Set([...(loc.tags || []), ...tags])];
}

function mergeMetadata(target, source) {
  for (const key of ["wikiEnTitle", "wikiRuTitle"]) {
    if (!target[key] && source[key]) target[key] = source[key];
  }
  if (!target.en && source.en) target.en = source.en;
  if (source.manualName || !target.name || target.name === target.en) target.name = source.name;
  addTags(target, source.tags || []);
}

function formatLocation(loc) {
  const fields = [
    `name: ${JSON.stringify(loc.name)}`,
    `lat: ${Number(loc.lat).toFixed(4)}`,
    `lng: ${Number(loc.lng).toFixed(4)}`,
    `country: ${JSON.stringify(loc.country || "")}`,
    `category: ${JSON.stringify(loc.category)}`,
  ];

  if (loc.en) fields.push(`en: ${JSON.stringify(loc.en)}`);
  if (loc.wikiEnTitle) fields.push(`wikiEnTitle: ${JSON.stringify(loc.wikiEnTitle)}`);
  if (loc.wikiRuTitle) fields.push(`wikiRuTitle: ${JSON.stringify(loc.wikiRuTitle)}`);
  if (loc.tags?.length) fields.push(`tags: ${JSON.stringify(loc.tags)}`);

  return `  { ${fields.join(", ")} }`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function reportLine(row) {
  return [
    row.status,
    row.en,
    row.name,
    row.country,
    row.lat ?? "",
    row.lng ?? "",
    row.wikiEnTitle ?? "",
    row.wikiRuTitle ?? "",
    row.note ?? "",
  ]
    .map(csvEscape)
    .join(",");
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function wikipediaBatch(titles) {
  if (!titles.length) return new Map();
  const params = new URLSearchParams({
    action: "query",
    prop: "langlinks|pageprops",
    lllang: "ru",
    redirects: "1",
    titles: titles.join("|"),
    format: "json",
    origin: "*",
  });
  const data = await fetchJson(`https://en.wikipedia.org/w/api.php?${params}`);
  const byInput = new Map();
  const normalized = new Map((data.query?.normalized || []).map((item) => [item.to, item.from]));
  const redirects = new Map((data.query?.redirects || []).map((item) => [item.to, item.from]));

  for (const page of Object.values(data.query?.pages || {})) {
    if (!page || page.missing !== undefined) continue;
    const original = redirects.get(page.title) || normalized.get(page.title) || page.title;
    byInput.set(original, {
      canonicalTitle: page.title,
      qid: page.pageprops?.wikibase_item || "",
      wikiRuTitle: page.langlinks?.[0]?.["*"] || "",
    });
  }
  return byInput;
}

async function wikidataBatch(qids) {
  if (!qids.length) return new Map();
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: qids.join("|"),
    props: "claims|labels|sitelinks",
    languages: "en|ru",
    sitefilter: "ruwiki",
    format: "json",
    origin: "*",
  });
  const data = await fetchJson(`https://www.wikidata.org/w/api.php?${params}`);
  const result = new Map();
  for (const [qid, entity] of Object.entries(data.entities || {})) {
    const countryQids =
      entity.claims?.P17?.map((claim) => claim.mainsnak?.datavalue?.value?.id).filter(Boolean) ||
      [];
    result.set(qid, {
      labelEn: entity.labels?.en?.value || "",
      labelRu: entity.labels?.ru?.value || "",
      wikiRuTitle: entity.sitelinks?.ruwiki?.title || "",
      countryQids,
    });
  }
  return result;
}

async function countryLabelsBatch(qids) {
  if (!qids.length) return new Map();
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: qids.join("|"),
    props: "labels",
    languages: "en|ru",
    format: "json",
    origin: "*",
  });
  const data = await fetchJson(`https://www.wikidata.org/w/api.php?${params}`);
  const result = new Map();
  for (const [qid, entity] of Object.entries(data.entities || {})) {
    const en = entity.labels?.en?.value || "";
    if (!en) continue;
    result.set(qid, { en, ru: entity.labels?.ru?.value || en });
  }
  return result;
}

function chunks(values, size) {
  const out = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

function parseCountryRuMap(html) {
  const match = html.match(/const COUNTRY_RU = (\{[\s\S]*?\});/u);
  if (!match) throw new Error("Could not find COUNTRY_RU map.");
  return Function(`return ${match[1]};`)();
}

function formatObjectLiteral(object) {
  return `{ ${Object.entries(object)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`)
    .join(",")} }`;
}

async function enrichRows(rows) {
  const titles = [
    ...new Set(
      rows
        .map((row) => row["Wikipedia EN"] || row["English name"])
        .map((title) => title.trim())
        .filter(Boolean),
    ),
  ];

  const wikiInfo = new Map();
  for (const group of chunks(titles, 45)) {
    const info = await wikipediaBatch(group);
    for (const [key, value] of info) wikiInfo.set(key, value);
    await sleep(80);
  }

  const qids = [...new Set([...wikiInfo.values()].map((item) => item.qid).filter(Boolean))];
  const wdInfo = new Map();
  for (const group of chunks(qids, 45)) {
    const info = await wikidataBatch(group);
    for (const [key, value] of info) wdInfo.set(key, value);
    await sleep(80);
  }

  const countryQids = [
    ...new Set([...wdInfo.values()].flatMap((item) => item.countryQids).filter(Boolean)),
  ];
  const countryInfo = new Map();
  for (const group of chunks(countryQids, 45)) {
    const info = await countryLabelsBatch(group);
    for (const [key, value] of info) countryInfo.set(key, value);
    await sleep(80);
  }

  return rows.map((row) => {
    const wikiInput = (row["Wikipedia EN"] || row["English name"]).trim();
    const info = wikiInfo.get(wikiInput) || {};
    const wd = wdInfo.get(info.qid) || {};
    const countries = (wd.countryQids || []).map((qid) => countryInfo.get(qid)).filter(Boolean);
    const en = row["English name"].trim();
    const wikiRuTitle = info.wikiRuTitle || wd.wikiRuTitle || "";
    const country = countries.map((item) => normalizeCountryLabel(item.en)).join(" / ");
    const countryRu = countries.map((item) => item.ru).join(" / ");
    const override = MANUAL_OVERRIDES[en] || {};
    return {
      en,
      name: override.name || wikiRuTitle || wd.labelRu || en,
      lat: Number(row.Latitude),
      lng: Number(row.Longitude),
      country: override.country || country,
      countryRu: override.countryRu || countryRu,
      category: inferCategory(row),
      tags: tagsFromCsv(row.Tags),
      wikiEnTitle: info.canonicalTitle || wikiInput || en,
      wikiRuTitle,
      manualName: Boolean(override.name),
      sourceTags: row.Tags,
    };
  });
}

const html = fs.readFileSync(HTML_PATH, "utf8");
const allRows = parseCsv(fs.readFileSync(SOURCE_PATH, "utf8"));
const rows = allRows.filter((row) => !/\bneeds\s+qa\b/iu.test(row.Tags || ""));
const locations = parseLocations(html);
const keyMap = buildKeyMap(locations);
const countryRu = parseCountryRuMap(html);
const enriched = await enrichRows(rows);
const report = [];
const stats = {
  source: allRows.length,
  importedSource: rows.length,
  skippedNeedsQa: allRows.length - rows.length,
  added: 0,
  updated: 0,
  skippedDuplicate: 0,
  invalidCoordinates: 0,
  ruLinked: 0,
  countriesResolved: 0,
};

for (const item of enriched) {
  if (!validCoordinates(item.lat, item.lng)) {
    stats.invalidCoordinates += 1;
    report.push({ status: "invalid-coordinates", ...item });
    continue;
  }

  const candidateKeys = [item.en, item.name, item.wikiEnTitle, item.wikiRuTitle]
    .map(normalize)
    .filter(Boolean);
  const existingIndex = candidateKeys
    .map((key) => keyMap.get(key))
    .find((index) => index !== undefined);

  if (item.wikiRuTitle) stats.ruLinked += 1;
  if (item.country) {
    stats.countriesResolved += 1;
    if (item.countryRu && !countryRu[item.country]) countryRu[item.country] = item.countryRu;
  }

  if (existingIndex !== undefined) {
    mergeMetadata(locations[existingIndex], item);
    stats.updated += 1;
    stats.skippedDuplicate += 1;
    report.push({
      status: "updated-existing",
      ...item,
      note: locations[existingIndex].en || locations[existingIndex].name,
    });
    continue;
  }

  const loc = {
    name: item.name,
    lat: item.lat,
    lng: item.lng,
    country: item.country,
    category: item.category,
    en: item.en,
    wikiEnTitle: item.wikiEnTitle,
    wikiRuTitle: item.wikiRuTitle,
    tags: item.tags,
  };
  if (!loc.tags.length) delete loc.tags;
  if (!loc.wikiRuTitle) delete loc.wikiRuTitle;

  const nextIndex = locations.length;
  locations.push(loc);
  for (const key of [loc.en, loc.name, loc.wikiEnTitle, loc.wikiRuTitle]
    .map(normalize)
    .filter(Boolean)) {
    if (!keyMap.has(key)) keyMap.set(key, nextIndex);
  }
  stats.added += 1;
  report.push({ status: "added", ...item });
}

const total = locations.length;
let nextHtml = html.replace(
  /const locations = \[[\s\S]*?\n\s*\];/u,
  [
    "const locations = [",
    `  // Combined Atlas Naturae dataset with scenic additions: ${total} mapped records.`,
    ...locations.map(
      (loc, index) => `${formatLocation(loc)}${index === locations.length - 1 ? "" : ","}`,
    ),
    "];",
  ].join("\n"),
);

nextHtml = nextHtml
  .replace(/Atlas Naturae — \d+ Wonders/gu, `Atlas Naturae — ${total} Wonders`)
  .replace(/Atlas Naturae — \d+ чудес/gu, `Atlas Naturae — ${total} чудес`)
  .replace(/>\s*\d+ Чудес<br>/u, `>${total} Чудес<br>`)
  .replace(/id="visitedTotal">\d+</u, `id="visitedTotal">${total}<`)
  .replace(
    /const COUNTRY_RU = \{[\s\S]*?\};/u,
    `const COUNTRY_RU = ${formatObjectLiteral(countryRu)};`,
  );

fs.writeFileSync(HTML_PATH, nextHtml, "utf8");
fs.writeFileSync(
  REPORT_PATH,
  ["status,en,name,country,lat,lng,wikiEnTitle,wikiRuTitle,note", ...report.map(reportLine)].join(
    "\n",
  ) + "\n",
  "utf8",
);

console.log(
  JSON.stringify(
    {
      ...stats,
      finalLocations: total,
      report: REPORT_PATH,
    },
    null,
    2,
  ),
);
