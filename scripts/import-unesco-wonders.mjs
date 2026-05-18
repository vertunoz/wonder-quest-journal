import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML_PATH = path.join(ROOT, "public", "atlas.html");
const SOURCE_PATH = process.argv[2] || "C:\\Users\\vertu\\Downloads\\files 2\\wonders.json";
const REPORT_PATH = path.join(ROOT, "unesco-import-report.csv");
const USER_AGENT = "WonderQuestJournal/1.0 (https://github.com/vertunoz/wonder-quest-journal)";

const EXISTING_UNESCO_NAMES = [
  "Iguazu Falls",
  "Great Barrier Reef",
  "Ha Long Bay",
  "Puerto Princesa Subterranean River National Park",
  "Victoria Falls",
  "Palawan",
  "Milford Sound",
  "Gal\u00e1pagos Islands",
  "Plitvice Lakes National Park",
  "Lake Baikal",
  "Great Blue Hole",
  "Madeira",
  "Geirangerfjord",
  "N\u00e6r\u00f8yfjord",
  "Jiuzhaigou",
  "Lake Malawi",
  "Hawaii (island)",
  "Lord Howe Island",
  "Marquesas Islands",
  "Yellowstone National Park",
  "Serengeti",
  "Dracaena cinnabari",
  "Yosemite National Park",
  "Daintree Rainforest",
  "Redwood National and State Parks",
  "Fiordland National Park",
  "Ngorongoro Conservation Area",
  "Olympic National Park",
  "Bia\u0142owie\u017ca Forest",
  "Okavango Delta",
  "Tasmanian Wilderness",
  "Kakadu National Park",
  "Garajonay National Park",
  "Blue Mountains (New South Wales)",
  "Sinharaja Forest Reserve",
  "Atlantic Forest",
  "Sundarbans",
  "Vall\u00e9e de Mai Nature Reserve",
  "G\u00f6reme",
  "Igua\u00e7u National Park",
  "Kinabalu Park",
  "Great Smoky Mountains National Park",
  "Yakushima",
  "Virunga National Park",
  "Sikhote-Alin",
  "Everglades National Park",
  "Durmitor",
  "Hyrcanian forests",
  "Teide National Park",
  "Wulingyuan",
  "Grand Canyon",
  "Namib",
  "Wadi Rum",
  "Len\u00e7\u00f3is Maranhenses National Park",
  "Meteora",
  "\u0160kocjan Caves",
  "Phong Nha Cave",
  "Puerto Princesa Subterranean River",
  "Tubbataha Reefs",
  "Aoraki / Mount Cook",
  "Carlsbad Caverns",
  "Mammoth Cave",
  "Gros Morne National Park",
  "Los Glaciares",
  "Talampaya",
  "Huascar\u00e1n National Park",
  "Chapada dos Veadeiros",
  "Rwenzori Mountains",
  "Tianzi Mountain",
  "Mount Huangshan",
  "Mount Emei",
  "Fox Glacier",
  "Jellyfish Lake",
  "Rock Islands",
  "Lake Ohrid",
];

const CATEGORY_KEYWORDS = [
  [
    "volcano",
    /\b(volcano|volcanic|geyser|geysir|geothermal|thermal|hot spring|lava|caldera|crater|fumarole|etna|fuji|kilimanjaro|rinjani|teide|stromboli|cotopaxi|arenal|vesuvius|eyjafjallajokull|dallol|tongariro|vulcan|vulkan)\b/u,
  ],
  [
    "ice_cave",
    /\b(glacier|ice|iceberg|cave|caves|cavern|caverns|grotto|crystal|karst|permafrost|fjord)\b/u,
  ],
  [
    "water",
    /\b(falls|fall|waterfall|waterfalls|lake|lakes|river|rivers|beach|bay|lagoon|sea|ocean|reef|island|islands|archipelago|coast|coastal|fjord|sound|pool|spring|springs|cenote|sinkhole|blue hole|cliff|cliffs|shore|cape|atoll|wetland|wetlands|delta|barrier reef)\b/u,
  ],
  [
    "desert",
    /\b(desert|canyon|gorge|valley|dune|dunes|salar|salt flat|badlands|wadi|mesa|sand|erg|depression|karst|pinnacle|pinnacles|towers)\b/u,
  ],
  [
    "forest",
    /\b(forest|forests|rainforest|rainforests|jungle|woods|grove|redwood|sequoia|bamboo|baobab|mangrove|garden|park|reserve|sanctuary|sundarbans|amazon)\b/u,
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
    .trim();
}

function parseLocations(html) {
  const match = html.match(/const locations = (\[[\s\S]*?\n\s*\]);/u);
  if (!match) throw new Error("Could not find locations array.");
  return Function(`return ${match[1]};`)();
}

function parseDisplayName(rawName) {
  const value = String(rawName || "").trim();
  const cyrillic = /[\u0400-\u04ff]/u;
  for (let index = value.lastIndexOf("("); index >= 0; index = value.lastIndexOf("(", index - 1)) {
    const tail = value
      .slice(index + 1)
      .replace(/\)+\s*$/u, "")
      .trim();
    if (cyrillic.test(tail)) {
      return {
        en: value.slice(0, index).trim(),
        name: tail,
      };
    }
  }

  const match = value.match(/^(.*?)\s*\((.*)\)\s*$/u);
  if (match) return { en: match[1].trim(), name: match[2].trim() };
  return { en: value, name: value };
}

function wikiTitleFromUrl(url) {
  if (!url) return "";
  const match = String(url).match(/\/wiki\/(.+)$/u);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]).replace(/_/g, " ");
  } catch {
    return match[1].replace(/_/g, " ");
  }
}

function extractQidFromWikidataUrl(url) {
  const match = String(url || "").match(/\/(Q\d+)(?:[#?].*)?$/u);
  return match ? match[1] : "";
}

function hasCoords(item) {
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  return (
    item.lat !== null &&
    item.lng !== null &&
    item.lat !== "" &&
    item.lng !== "" &&
    validCoordinates(lat, lng)
  );
}

function validCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
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

function addTag(loc, tag) {
  const tags = new Set(loc.tags || []);
  tags.add(tag);
  loc.tags = [...tags];
}

function mergeMetadata(target, source) {
  for (const key of ["wikiEnTitle", "wikiRuTitle"]) {
    if (!target[key] && source[key]) target[key] = source[key];
  }
  addTag(target, "unesco");
}

function inferCategory(item, existingCategory) {
  if (existingCategory) return existingCategory;
  const tokens = normalize(
    [item.en, item.name, item.wikiEnTitle, item.wikiRuTitle, item.country].join(" "),
  );
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(tokens)) return category;
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
  ];

  if (loc.en) fields.push(`en: ${JSON.stringify(loc.en)}`);
  if (loc.wikiEnTitle) fields.push(`wikiEnTitle: ${JSON.stringify(loc.wikiEnTitle)}`);
  if (loc.wikiRuTitle) fields.push(`wikiRuTitle: ${JSON.stringify(loc.wikiRuTitle)}`);
  if (loc.tags?.length) fields.push(`tags: ${JSON.stringify(loc.tags)}`);

  return `  { ${fields.join(", ")} }`;
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

function wikidataCoordinateFromEntity(entity) {
  const claims = entity?.claims?.P625;
  const value = claims?.[0]?.mainsnak?.datavalue?.value;
  if (!value) return null;
  const lat = Number(value.latitude);
  const lng = Number(value.longitude);
  if (!validCoordinates(lat, lng)) return null;
  return {
    lat,
    lng,
    source: "wikidata:P625",
  };
}

async function coordinatesFromQid(qid) {
  if (!qid) return null;
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`;
  const data = await fetchJson(url);
  return wikidataCoordinateFromEntity(data.entities?.[qid]);
}

async function coordinatesFromWikipedia(title, lang) {
  if (!title) return null;
  const params = new URLSearchParams({
    action: "query",
    prop: "coordinates|pageprops",
    titles: title,
    colimit: "1",
    coprimary: "all",
    format: "json",
    origin: "*",
  });
  const data = await fetchJson(`https://${lang}.wikipedia.org/w/api.php?${params}`);
  const page = Object.values(data.query?.pages || {})[0];
  if (!page || page.missing) return null;
  const coord = page.coordinates?.[0];
  if (coord) {
    return {
      lat: Number(coord.lat),
      lng: Number(coord.lon),
      source: `${lang}.wikipedia:coordinates`,
    };
  }
  return coordinatesFromQid(page.pageprops?.wikibase_item);
}

async function resolveCoordinates(item) {
  if (hasCoords(item)) {
    return { lat: Number(item.lat), lng: Number(item.lng), source: "input" };
  }

  const attempts = [
    () => coordinatesFromWikipedia(item.wikiEnTitle, "en"),
    () => coordinatesFromWikipedia(item.wikiRuTitle, "ru"),
    () => coordinatesFromQid(extractQidFromWikidataUrl(item.wikidata)),
  ];

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (result && validCoordinates(result.lat, result.lng)) return result;
    } catch (error) {
      item.lastCoordinateError = error.message;
    }
    await sleep(50);
  }
  return null;
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
    row.source ?? "",
    row.note ?? "",
  ]
    .map(csvEscape)
    .join(",");
}

const html = fs.readFileSync(HTML_PATH, "utf8");
const sourceItems = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));
const locations = parseLocations(html);
const keyMap = buildKeyMap(locations);
const report = [];
const stats = {
  source: sourceItems.length,
  existingTaggedFromSheet: 0,
  updatedFromSource: 0,
  added: 0,
  unresolved: 0,
  coordinateResolved: 0,
};

for (const name of EXISTING_UNESCO_NAMES) {
  const index = keyMap.get(normalize(name));
  if (index === undefined) continue;
  addTag(locations[index], "unesco");
  stats.existingTaggedFromSheet += 1;
}

for (const rawItem of sourceItems) {
  const display = parseDisplayName(rawItem.name);
  const item = {
    ...rawItem,
    ...display,
    wikiEnTitle: wikiTitleFromUrl(rawItem.wiki_en) || display.en,
    wikiRuTitle: wikiTitleFromUrl(rawItem.wiki_ru),
  };
  const candidateKeys = [item.en, item.name, item.wikiEnTitle, item.wikiRuTitle, rawItem.name]
    .map(normalize)
    .filter(Boolean);
  const existingIndex = candidateKeys
    .map((key) => keyMap.get(key))
    .find((index) => index !== undefined);

  if (existingIndex !== undefined) {
    mergeMetadata(locations[existingIndex], item);
    stats.updatedFromSource += 1;
    report.push({
      status: "updated-existing",
      en: item.en,
      name: item.name,
      country: item.country,
      note: locations[existingIndex].en || locations[existingIndex].name,
    });
    continue;
  }

  const coordinates = await resolveCoordinates(item);
  if (!coordinates) {
    stats.unresolved += 1;
    report.push({
      status: "unresolved-coordinates",
      en: item.en,
      name: item.name,
      country: item.country,
      note: item.lastCoordinateError || "no coordinates found",
    });
    continue;
  }

  if (coordinates.source !== "input") stats.coordinateResolved += 1;

  const loc = {
    name: item.name,
    lat: coordinates.lat,
    lng: coordinates.lng,
    country: item.country,
    category: inferCategory(item),
    en: item.en,
    wikiEnTitle: item.wikiEnTitle,
    wikiRuTitle: item.wikiRuTitle,
    tags: ["unesco"],
  };

  const nextIndex = locations.length;
  locations.push(loc);
  for (const key of [loc.en, loc.name, loc.wikiEnTitle, loc.wikiRuTitle]
    .map(normalize)
    .filter(Boolean)) {
    if (!keyMap.has(key)) keyMap.set(key, nextIndex);
  }
  stats.added += 1;
  report.push({
    status: "added",
    en: loc.en,
    name: loc.name,
    country: loc.country,
    lat: loc.lat,
    lng: loc.lng,
    source: coordinates.source,
  });
}

const block = [
  "const locations = [",
  `  // Combined Atlas Naturae dataset with UNESCO import: ${locations.length} mapped records.`,
  ...locations.map(
    (loc, index) => `${formatLocation(loc)}${index === locations.length - 1 ? "" : ","}`,
  ),
  "];",
].join("\n");

const nextHtml = html.replace(/const locations = \[[\s\S]*?\n\s*\];/u, block);
fs.writeFileSync(HTML_PATH, nextHtml, "utf8");

const reportCsv = ["status,en,name,country,lat,lng,source,note", ...report.map(reportLine)].join(
  "\n",
);
fs.writeFileSync(REPORT_PATH, `${reportCsv}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ...stats,
      finalLocations: locations.length,
      report: REPORT_PATH,
    },
    null,
    2,
  ),
);
