import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(import.meta.dirname, "..");
const atlasPath = path.join(repoRoot, "public", "atlas.html");
const sourcePath =
  process.argv[2] || "C:\\Users\\vertu\\Downloads\\content-help-needed_enriched.xlsx";
const reportPath = path.join(repoRoot, "content-help-import-report.csv");

function decodeXml(value = "") {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function repairMojibake(value) {
  if (value == null) return "";
  const text = String(value);
  if (!/[ÐÑÂÃ]/.test(text)) return text;
  const repaired = Buffer.from(text, "latin1").toString("utf8");
  const badBefore = (text.match(/[ÐÑÂÃ]/g) || []).length;
  const badAfter = (repaired.match(/[ÐÑÂÃ]/g) || []).length;
  return badAfter < badBefore ? repaired : text;
}

function extractXlsx(xlsxPath) {
  if (!fs.existsSync(xlsxPath)) throw new Error(`XLSX not found: ${xlsxPath}`);
  const dir = path.join(os.tmpdir(), `travel-wonders-xlsx-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  const command = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem;",
    `[System.IO.Compression.ZipFile]::ExtractToDirectory('${xlsxPath.replace(/'/g, "''")}','${dir.replace(/'/g, "''")}')`,
  ].join(" ");
  execFileSync("powershell", ["-NoProfile", "-Command", command], { stdio: "ignore" });
  return dir;
}

function readSharedStrings(dir) {
  const file = path.join(dir, "xl", "sharedStrings.xml");
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, "utf8");
  const strings = [];
  for (const match of xml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)) {
    const chunks = [...match[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) =>
      decodeXml(m[1]),
    );
    strings.push(repairMojibake(chunks.join("")));
  }
  return strings;
}

function columnIndex(cellRef) {
  const letters = String(cellRef || "").replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

function readCell(cellXml, sharedStrings) {
  const type = /<(?:\w+:)?c\b[^>]*\bt="([^"]+)"/.exec(cellXml)?.[1];
  if (type === "s") {
    const idx = Number(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(cellXml)?.[1] || -1);
    return sharedStrings[idx] || "";
  }
  if (type === "inlineStr") {
    const chunks = [...cellXml.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) =>
      decodeXml(m[1]),
    );
    return repairMojibake(chunks.join(""));
  }
  const raw = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(cellXml)?.[1] || "";
  return repairMojibake(decodeXml(raw));
}

function readSheetRows(dir, sheetName = "sheet1.xml") {
  const sharedStrings = readSharedStrings(dir);
  const xml = fs.readFileSync(path.join(dir, "xl", "worksheets", sheetName), "utf8");
  const rows = [];
  for (const rowMatch of xml.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(
      /<(?:\w+:)?c\b[^>]*\/>|<(?:\w+:)?c\b[^>]*>[\s\S]*?<\/(?:\w+:)?c>/g,
    )) {
      const ref = /\br="([^"]+)"/.exec(cellMatch[0])?.[1];
      if (!ref) continue;
      row[columnIndex(ref)] = readCell(cellMatch[0], sharedStrings);
    }
    rows.push(row);
  }
  return rows;
}

function parseWorkbookRows(xlsxPath) {
  const dir = extractXlsx(xlsxPath);
  try {
    const rows = readSheetRows(dir, "sheet1.xml");
    const headers = rows.shift().map((h) => String(h || "").trim());
    return rows
      .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] || ""])))
      .filter(
        (row) =>
          row.index !== "" &&
          (row.description_ru || row.description_en || row.facts_ru || row.facts_en),
      );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function extractLocations(atlasHtml) {
  const start = atlasHtml.indexOf("const locations = [");
  if (start === -1) throw new Error("Could not find locations array");
  const arrayStart = atlasHtml.indexOf("[", start);
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;
  for (let i = arrayStart; i < atlasHtml.length; i += 1) {
    const ch = atlasHtml[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        const source = atlasHtml.slice(arrayStart, i + 1);
        return vm.runInNewContext(source, {});
      }
    }
  }
  throw new Error("Could not parse locations array");
}

function splitFacts(value) {
  return repairMojibake(value)
    .split(/\r?\n|\s*\|\s*|(?:^|\s+)•\s*/u)
    .map((part) => part.replace(/^[-–—*•]\s*/u, "").trim())
    .filter(Boolean)
    .filter((fact) => !isMetaFact(fact));
}

function cleanText(value) {
  return repairMojibake(value).replace(/\s+/g, " ").trim();
}

function isMetaFact(value) {
  const text = cleanText(value).toLowerCase();
  return [
    "в таблице",
    "исходном файле",
    "wikipedia-поле",
    "координат",
    "для карточки",
    "тег instagram",
    "the table already includes",
    "in the source file",
    "wikipedia field",
    "coordinates",
    "for the card",
    "the instagram tag",
  ].some((needle) => text.includes(needle));
}

function contentKey(index) {
  return String(Number(index));
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildManualContent(rows, locations) {
  const content = {};
  const report = [
    [
      "status",
      "index",
      "name_ru",
      "name_en",
      "description_ru",
      "facts_ru",
      "description_en",
      "facts_en",
      "notes",
    ],
  ];

  for (const row of rows) {
    const index = Number(row.index);
    const loc = locations[index];
    if (!Number.isInteger(index) || !loc) {
      report.push([
        "missing-location",
        row.index,
        row.name_ru,
        row.name_en,
        "",
        "",
        "",
        "",
        "No matching atlas index",
      ]);
      continue;
    }

    const entry = {
      ru: {
        description: cleanText(row.description_ru),
        facts: splitFacts(row.facts_ru),
      },
      en: {
        description: cleanText(row.description_en),
        facts: splitFacts(row.facts_en),
      },
    };

    if (row.image && !loc.image) entry.image = cleanText(row.image);
    content[contentKey(index)] = entry;
    report.push([
      "imported",
      index,
      loc.name || row.name_ru,
      loc.en || row.name_en,
      entry.ru.description ? "yes" : "no",
      entry.ru.facts.length,
      entry.en.description ? "yes" : "no",
      entry.en.facts.length,
      row.notes || "",
    ]);
  }
  return { content, report };
}

function replaceManualContentBlock(atlasHtml, content) {
  const block = [
    "// BEGIN MANUAL_CONTENT",
    "const MANUAL_CONTENT = " + JSON.stringify(content, null, 2) + ";",
    "",
    "function manualContentFor(index) {",
    "  const content = MANUAL_CONTENT[String(index)];",
    "  if (!content) return null;",
    "  return content[currentLang] || content.ru || content.en || null;",
    "}",
    "// END MANUAL_CONTENT",
  ].join("\n");

  const marker = "// BEGIN MANUAL_CONTENT";
  const endMarker = "// END MANUAL_CONTENT";
  if (atlasHtml.includes(marker)) {
    const start = atlasHtml.indexOf(marker);
    const end = atlasHtml.indexOf(endMarker, start);
    if (end === -1) throw new Error("Manual content block is missing end marker");
    return atlasHtml.slice(0, start) + block + atlasHtml.slice(end + endMarker.length);
  }
  const anchor = "const summaryCache = new Map();";
  if (!atlasHtml.includes(anchor)) throw new Error("Could not find summary cache anchor");
  return atlasHtml.replace(anchor, `${anchor}\n\n${block}`);
}

function main() {
  const atlasHtml = fs.readFileSync(atlasPath, "utf8");
  const locations = extractLocations(atlasHtml);
  const rows = parseWorkbookRows(sourcePath);
  const { content, report } = buildManualContent(rows, locations);
  const nextHtml = replaceManualContentBlock(atlasHtml, content);
  fs.writeFileSync(atlasPath, nextHtml, "utf8");
  fs.writeFileSync(
    reportPath,
    "\uFEFF" + report.map((row) => row.map(csvEscape).join(",")).join("\n"),
    "utf8",
  );
  console.log(
    JSON.stringify(
      {
        rows: rows.length,
        imported: Object.keys(content).length,
        report: reportPath,
      },
      null,
      2,
    ),
  );
}

main();
