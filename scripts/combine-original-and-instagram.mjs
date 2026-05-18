import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML_PATH = path.join(ROOT, "public", "atlas.html");
const ORIGINAL_REF = process.argv[2] || "aac70bc:public/atlas.html";

function parseLocations(html) {
  const match = html.match(/const locations = (\[[\s\S]*?\n\]);/);
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

const currentHtml = fs.readFileSync(HTML_PATH, "utf8");
const originalHtml = childProcess.execFileSync("git", ["show", ORIGINAL_REF], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});

const originalLocations = parseLocations(originalHtml);
const instagramLocations = parseLocations(currentHtml);
const mergedLocations = [...originalLocations, ...instagramLocations];

const block = [
  "const locations = [",
  `  // Combined Atlas Naturae dataset: ${originalLocations.length} original records + ${instagramLocations.length} Instagram records.`,
  ...mergedLocations.map(
    (loc, index) => `${formatLocation(loc)}${index === mergedLocations.length - 1 ? "" : ","}`,
  ),
  "];",
].join("\n");

const nextHtml = currentHtml.replace(/const locations = \[[\s\S]*?\n\];/, block);
fs.writeFileSync(HTML_PATH, nextHtml, "utf8");

console.log(
  JSON.stringify({
    original: originalLocations.length,
    instagram: instagramLocations.length,
    merged: mergedLocations.length,
  }),
);
