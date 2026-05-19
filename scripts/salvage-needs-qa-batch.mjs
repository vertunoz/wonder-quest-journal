import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML_PATH = path.join(ROOT, "public", "atlas.html");
const SOURCE_PATH =
  "C:\\Users\\vertu\\Downloads\\new-natural-scenic-additions_unique_all_coords_wikipedia_filled.csv";
const IMPORTABLE_PATH = path.join(ROOT, "needs-qa-batch-importable.csv");
const UNRESOLVED_PATH = path.join(ROOT, "needs-qa-batch-unresolved.csv");
const CANDIDATES_PATH = path.join(ROOT, "needs-qa-batch-candidates.csv");
const USER_AGENT = "WonderQuestJournal/1.0 (https://github.com/vertunoz/wonder-quest-journal)";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/u, "").split("=");
    return [key, value];
  }),
);

const apply = args.get("apply") === "true";
const minScore = args.has("min-score") ? Number(args.get("min-score")) : 100;
const concurrency = args.has("concurrency") ? Number(args.get("concurrency")) : 2;

const SUFFIXES = [
  "mountain valleys",
  "forest reserves",
  "river gorges",
  "coastal wetlands",
  "desert landscapes",
  "lake district",
  "highland plateau",
];

const CATEGORY_MAP = new Map([
  ["Waters and Coasts", "water"],
  ["Mountains and Rocks", "mountain"],
  ["Forests and Parks", "forest"],
  ["Deserts and Canyons", "desert"],
  ["Volcanoes and Geysers", "volcano"],
  ["Ice and Caves", "ice_cave"],
]);

const CATEGORY_TYPES = {
  water: ["Q23397", "Q4022", "Q34038", "Q23442", "Q170321", "Q39594", "Q184358"],
  mountain: ["Q8502", "Q46831", "Q39816", "Q133056"],
  forest: ["Q4421", "Q46169", "Q179049", "Q473972"],
  desert: ["Q8514", "Q150784", "Q39816", "Q37901", "Q25391"],
  volcano: ["Q8072", "Q177380", "Q190429"],
  ice_cave: ["Q35666", "Q35509", "Q47521"],
};

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
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
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
    .replace(/[^a-z0-9\u0430-\u044f\u0451]+/giu, " ")
    .replace(/\b(national park|nature reserve|reserve|park|sanctuary|biosphere)\b/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function seedName(row) {
  const lower = row["English name"].toLowerCase();
  const suffix = SUFFIXES.find((item) => lower.endsWith(item));
  return suffix ? row["English name"].slice(0, -suffix.length).trim() : row["Wikipedia EN"].trim();
}

function chunks(values, size) {
  const out = [];
  for (let index = 0; index < values.length; index += size)
    out.push(values.slice(index, index + size));
  return out;
}

async function fetchJson(url, options = {}) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || 18000);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          ...(options.headers || {}),
        },
      });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    } catch (error) {
      clearTimeout(timer);
      if (attempt === 3) throw error;
      await sleep(600 * attempt);
    }
  }
  return null;
}

async function wikipediaBatch(titles) {
  const result = new Map();
  for (const group of chunks(titles, 45)) {
    const params = new URLSearchParams({
      action: "query",
      prop: "pageprops",
      redirects: "1",
      titles: group.join("|"),
      format: "json",
      origin: "*",
    });
    const data = await fetchJson(`https://en.wikipedia.org/w/api.php?${params}`);
    const redirects = new Map((data.query?.redirects || []).map((item) => [item.to, item.from]));
    const normalized = new Map((data.query?.normalized || []).map((item) => [item.to, item.from]));
    for (const page of Object.values(data.query?.pages || {})) {
      if (!page || page.missing !== undefined || page.pageprops?.disambiguation !== undefined)
        continue;
      const original = redirects.get(page.title) || normalized.get(page.title) || page.title;
      result.set(original, {
        qid: page.pageprops?.wikibase_item || "",
        title: page.title,
      });
    }
    await sleep(60);
  }
  return result;
}

async function entityBatch(qids) {
  const result = new Map();
  for (const group of chunks(qids, 50)) {
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: group.join("|"),
      props: "claims|labels",
      languages: "en|ru",
      format: "json",
      origin: "*",
    });
    const data = await fetchJson(`https://www.wikidata.org/w/api.php?${params}`);
    for (const [qid, entity] of Object.entries(data.entities || {})) result.set(qid, entity);
    await sleep(60);
  }
  return result;
}

function countryQidFor(entity, ownQid) {
  const direct = entity?.claims?.P17?.[0]?.mainsnak?.datavalue?.value?.id || "";
  if (direct) return direct;
  const isCountry = (entity?.claims?.P31 || [])
    .map((claim) => claim.mainsnak?.datavalue?.value?.id)
    .some((id) => id === "Q6256" || id === "Q3624078");
  return isCountry ? ownQid : "";
}

async function sparql(query) {
  return fetchJson("https://query.wikidata.org/sparql", {
    method: "POST",
    timeoutMs: 30000,
    headers: {
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query }),
  });
}

function countryCandidateQuery(countryQid, typeQids) {
  const values = typeQids.map((qid) => `wd:${qid}`).join(" ");
  return `SELECT ?item ?itemLabel ?coord ?enArticle ?ruArticle ?image ?typeLabel ?country WHERE {
    ?item wdt:P17 wd:${countryQid}.
    ?item wdt:P625 ?coord.
    ?item wdt:P18 ?image.
    ?item wdt:P31/wdt:P279* ?type.
    VALUES ?type { ${values} }
    ?enArticle schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>.
    OPTIONAL { ?ruArticle schema:about ?item; schema:isPartOf <https://ru.wikipedia.org/>. }
    OPTIONAL { ?item wdt:P17 ?country. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en". }
  }
  ORDER BY DESC(BOUND(?ruArticle)) DESC(BOUND(?image))
  LIMIT 180`;
}

function parsePoint(value) {
  const match = String(value || "").match(/Point\(([-0-9.]+) ([-0-9.]+)\)/u);
  return match ? { lng: Number(match[1]), lat: Number(match[2]) } : null;
}

function articleTitle(url) {
  const match = String(url || "").match(/\/wiki\/(.+)$/u);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]).replace(/_/gu, " ");
  } catch {
    return match[1].replace(/_/gu, " ");
  }
}

function existingKeySet(locations) {
  const keys = new Set();
  for (const loc of locations) {
    for (const key of [loc.en, loc.name, loc.wikiEnTitle, loc.wikiRuTitle]
      .map(normalize)
      .filter(Boolean)) {
      keys.add(key);
    }
  }
  return keys;
}

function isJunk(candidate) {
  return /church|mosque|castle|monastery|prison|fortress|museum|building|settlement|village|town|city|district|province|administrative|municipality|commune|airport|station|bridge|road|street|school|university|temple|palace|memorial|monument|archaeological|historic/i.test(
    [
      candidate.en,
      candidate.name,
      candidate.wikiEnTitle,
      candidate.wikiRuTitle,
      candidate.typeLabel,
    ].join(" "),
  );
}

function score(candidate, existingKeys, usedQids) {
  let value = 45;
  if (candidate.wikiEnTitle) value += 20;
  if (candidate.wikiRuTitle) value += 20;
  if (candidate.image) value += 15;
  if (candidate.country) value += 8;
  if (usedQids.has(candidate.item)) value -= 100;
  if (
    [candidate.en, candidate.name, candidate.wikiEnTitle, candidate.wikiRuTitle]
      .map(normalize)
      .some((key) => existingKeys.has(key))
  ) {
    value -= 100;
  }
  if (isJunk(candidate)) value -= 150;
  return value;
}

function mapCandidate(binding, row, countryLabels, category) {
  const point = parsePoint(binding.coord?.value);
  const enTitle = articleTitle(binding.enArticle?.value);
  const ruTitle = articleTitle(binding.ruArticle?.value);
  const countryQids = String(binding.country?.value || "")
    .match(/Q\d+$/gu)
    ?.join(" / ");
  const wikidataCountry = countryQids
    ? countryQids
        .split(" / ")
        .map((qid) => countryLabels.get(qid)?.en || "")
        .filter(Boolean)
        .join(" / ")
    : "";
  const country = normalizeCountryLabel(row.countryLabel || wikidataCountry);
  const typeText = binding.typeLabel?.value || "";
  return {
    sourceIndex: row["#"],
    status: "",
    score: 0,
    sourceName: row["English name"],
    seed: row.seed,
    item: binding.item?.value?.match(/Q\d+$/u)?.[0] || "",
    en: enTitle || binding.itemLabel?.value || "",
    name: ruTitle || binding.itemLabel?.value || enTitle || "",
    country,
    lat: point?.lat ?? "",
    lng: point?.lng ?? "",
    category: actualCategory(
      typeText,
      [enTitle, ruTitle, binding.itemLabel?.value].join(" "),
      category,
    ),
    wikiEnTitle: enTitle,
    wikiRuTitle: ruTitle,
    image: binding.image?.value || "",
    typeLabel: typeText,
    note: `country:${row.countryLabel}`,
  };
}

function normalizeCountryLabel(value) {
  return (
    {
      "People's Republic of China": "China",
      "United States of America": "United States",
    }[value] || value
  );
}

function actualCategoryLegacy(typeLabel, text, fallback) {
  const hay = `${typeLabel} ${text}`.toLowerCase();
  if (/volcano|geyser|crater|вулкан|гейзер|кратер/u.test(hay)) return "volcano";
  if (/glacier|cave|fjord|ледник|пещер|фьорд/u.test(hay)) return "ice_cave";
  if (
    /river|lake|waterfall|island|reef|bay|sea|channel|strait|wetland|река|озер|озёр|водопад|остров|риф|бухт|море|пролив|болот/u.test(
      hay,
    )
  ) {
    return "water";
  }
  if (/desert|canyon|valley|gorge|dune|пустын|каньон|долин|ущель|дюн/u.test(hay)) return "desert";
  if (
    /forest|national park|nature reserve|protected|лес|национальный парк|заповед|природоохран/u.test(
      hay,
    )
  ) {
    return "forest";
  }
  if (/mount|mountain|range|peak|pass|гора|горн|пик|перевал|хребет/u.test(hay)) return "mountain";
  return fallback;
}

function actualCategory(typeLabel, text, fallback) {
  const hay = `${typeLabel} ${text}`.toLowerCase();
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
    /\bmount\b|\bmountain\b|\brange\b|\bpeak\b|\bpass\b|\u0433\u043e\u0440\u0430|\u0433\u043e\u0440\u043d|\u043f\u0438\u043a|\u043f\u0435\u0440\u0435\u0432\u0430\u043b|\u0445\u0440\u0435\u0431\u0435\u0442/u.test(
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
  return fallback;
}

async function mapLimit(items, count, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const current = next;
      next += 1;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, count) }, run));
  return results;
}

function uniqueCandidates(candidates) {
  const best = new Map();
  for (const candidate of candidates) {
    const key = candidate.item || normalize(candidate.en || candidate.name);
    const current = best.get(key);
    if (!current || candidate.score > current.score) best.set(key, candidate);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows) {
  const header = [
    "sourceIndex",
    "status",
    "score",
    "sourceName",
    "seed",
    "item",
    "en",
    "name",
    "country",
    "lat",
    "lng",
    "category",
    "wikiEnTitle",
    "wikiRuTitle",
    "image",
    "typeLabel",
    "note",
  ];
  fs.writeFileSync(
    filePath,
    `${[header.join(","), ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(","))].join("\n")}\n`,
    "utf8",
  );
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
  return `  { ${fields.join(", ")} }`;
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
    .replace(/Atlas Naturae — \d+ Wonders/gu, `Atlas Naturae — ${total} Wonders`)
    .replace(/Atlas Naturae — \d+ чудес/gu, `Atlas Naturae — ${total} чудес`)
    .replace(/>\s*\d+ Чудес<br>/u, `>${total} Чудес<br>`)
    .replace(/id="visitedTotal">\d+</u, `id="visitedTotal">${total}<`);
}

const html = fs.readFileSync(HTML_PATH, "utf8");
const locations = parseLocations(html);
const existingKeys = existingKeySet(locations);
const usedQids = new Set();
const rows = parseCsv(fs.readFileSync(SOURCE_PATH, "utf8"))
  .filter((row) => /\bneeds\s+qa\b/iu.test(row.Tags || ""))
  .map((row) => ({
    ...row,
    seed: seedName(row),
    category: CATEGORY_MAP.get(row.Category) || "mountain",
  }));

const seedTitles = [...new Set(rows.map((row) => row.seed).filter(Boolean))];
console.log(`Resolving ${seedTitles.length} seed pages...`);
const wikiByTitle = await wikipediaBatch(seedTitles);
const seedQids = [...new Set([...wikiByTitle.values()].map((item) => item.qid).filter(Boolean))];
console.log(`Fetching ${seedQids.length} seed entities...`);
const seedEntities = await entityBatch(seedQids);
const countryQids = [
  ...new Set(seedQids.map((qid) => countryQidFor(seedEntities.get(qid), qid)).filter(Boolean)),
];
console.log(`Fetching ${countryQids.length} country labels...`);
const countryEntities = await entityBatch(countryQids);
const countryLabels = new Map(
  countryQids.map((qid) => [
    qid,
    {
      en: countryEntities.get(qid)?.labels?.en?.value || qid,
      ru:
        countryEntities.get(qid)?.labels?.ru?.value ||
        countryEntities.get(qid)?.labels?.en?.value ||
        qid,
    },
  ]),
);

for (const row of rows) {
  const wiki = wikiByTitle.get(row.seed);
  row.seedQid = wiki?.qid || "";
  row.countryQid = row.seedQid ? countryQidFor(seedEntities.get(row.seedQid), row.seedQid) : "";
  row.countryLabel = countryLabels.get(row.countryQid)?.en || "";
}

const unresolved = rows
  .filter((row) => !row.countryQid)
  .map((row) => ({ ...row, status: "unresolved", note: "could not resolve seed country" }));
const rowsByGroup = new Map();
for (const row of rows.filter((item) => item.countryQid)) {
  const key = `${row.countryQid}|${row.category}`;
  if (!rowsByGroup.has(key)) rowsByGroup.set(key, []);
  rowsByGroup.get(key).push(row);
}

const groups = [...rowsByGroup.entries()].map(([key, groupRows]) => {
  const [countryQid, category] = key.split("|");
  return { countryQid, category, rows: groupRows };
});
console.log(`Querying ${groups.length} country/category pools...`);

const allCandidates = [];
const importable = [];
await mapLimit(groups, concurrency, async (group, index) => {
  try {
    const typeQids = CATEGORY_TYPES[group.category] || [];
    const data = await sparql(countryCandidateQuery(group.countryQid, typeQids));
    let pool = uniqueCandidates(
      (data.results?.bindings || []).map((binding) =>
        mapCandidate(
          binding,
          { ...group.rows[0], countryLabel: countryLabels.get(group.countryQid)?.en || "" },
          countryLabels,
          group.category,
        ),
      ),
    );
    pool = pool.map((candidate) => ({
      ...candidate,
      score: score(candidate, existingKeys, usedQids),
    }));
    allCandidates.push(
      ...pool.slice(0, Math.min(20, group.rows.length + 5)).map((candidate) => ({
        ...candidate,
        status: candidate.score >= minScore ? "candidate" : "low-score",
      })),
    );

    for (const row of group.rows) {
      const chosen = pool.find((candidate) => {
        const currentScore = score(candidate, existingKeys, usedQids);
        candidate.score = currentScore;
        return currentScore >= minScore;
      });
      if (!chosen) {
        unresolved.push({
          ...row,
          status: "unresolved",
          note: "no country/category candidate above threshold",
        });
        continue;
      }
      usedQids.add(chosen.item);
      for (const key of [chosen.en, chosen.name, chosen.wikiEnTitle, chosen.wikiRuTitle]
        .map(normalize)
        .filter(Boolean)) {
        existingKeys.add(key);
      }
      importable.push({
        ...chosen,
        sourceIndex: row["#"],
        sourceName: row["English name"],
        seed: row.seed,
        status: "importable",
      });
    }
  } catch (error) {
    for (const row of group.rows) unresolved.push({ ...row, status: "error", note: error.message });
  }
  if ((index + 1) % 25 === 0)
    console.log(`Processed groups ${index + 1}/${groups.length}; importable=${importable.length}`);
});

writeCsv(CANDIDATES_PATH, allCandidates);
writeCsv(IMPORTABLE_PATH, importable);
writeCsv(UNRESOLVED_PATH, unresolved);

if (apply) {
  for (const item of importable) {
    locations.push({
      name: item.name,
      lat: Number(item.lat),
      lng: Number(item.lng),
      country: item.country,
      category: item.category,
      en: item.en,
      wikiEnTitle: item.wikiEnTitle,
      wikiRuTitle: item.wikiRuTitle,
    });
  }
  fs.writeFileSync(HTML_PATH, updateHtml(html, locations), "utf8");
}

console.log(
  JSON.stringify(
    {
      source: rows.length,
      importable: importable.length,
      unresolved: unresolved.length,
      groups: groups.length,
      applied: apply,
      minScore,
      files: {
        importable: IMPORTABLE_PATH,
        unresolved: UNRESOLVED_PATH,
        candidates: CANDIDATES_PATH,
      },
    },
    null,
    2,
  ),
);
