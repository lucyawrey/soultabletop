// Converts Cairn Second Edition's text into our content files in
// systems/cairn/content/<type>/<readable-id>.json: the marketplace and the
// reliquary (items), spellbooks, backgrounds, and the bestiary (monsters).
// The source is the Markdown of the official Cairn site, licensed CC-BY-SA 4.0.
//   node scripts/cairn/convert.mjs [path to the yochaigal/cairn checkout]
// The checkout defaults to ~/Developer/cairn; it is only read, never cloned
// or updated. Temporary, like build-types.mjs: once the authoring CLI exists,
// the files it writes are the source.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const cairn = process.argv[2] ?? join(homedir(), "Developer", "cairn");
const edition = join(cairn, "second-edition");
const outDir = new URL("../../systems/cairn/content/", import.meta.url);
const playersGuide = "Cairn Second Edition, Player's Guide";
const wardensGuide = "Cairn Second Edition, Warden's Guide";

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const warnings = [];
const warn = (message) => warnings.push(message);
const read = (path) => readFileSync(join(edition, path), "utf8");
const unbold = (text) => text.replace(/\*\*/g, "").trim();
const sentence = (text) => (text ? (/^d\d/.test(text) ? text : text[0].toUpperCase() + text.slice(1)) + (/[.!?]$/.test(text) ? "" : ".") : "");

// The body rows of each Markdown table in `text`, as trimmed cells.
function tableRows(text) {
  const isSeparator = (line) => /^\|\s*:?-/.test(line ?? "");
  const lines = text.split("\n").map((line) => line.trim());
  return lines
    .filter((line, index) => line.startsWith("|") && !isSeparator(line) && !isSeparator(lines[index + 1]))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

// `## Heading` sections of a page, after its front matter.
function sections(text) {
  return text
    .split(/^## /m)
    .slice(1)
    .map((part) => {
      const [heading, ...body] = part.split("\n");
      return { heading: heading.trim(), body: body.join("\n").trim() };
    });
}

// Splits on commas that aren't inside parentheses.
function splitTop(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Item qualities written after a name, such as "2 uses", "+1 Armor", "_bulky_",
// or "d8 damage". Returns the fields they set and the qualities left over.
function itemQualities(qualities) {
  const data = {};
  const rest = [];
  for (const quality of qualities) {
    let match;
    if (quality === "_petty_") data.slots = 0;
    else if (quality === "_bulky_") data.slots = 2;
    else if ((match = quality.match(/^(\d+) uses?$/))) data.uses = Number(match[1]);
    else if ((match = quality.match(/^(\d+) charges?$/))) data.charges = Number(match[1]);
    else if ((match = quality.match(/^\+?(\d+) Armor$/))) data.armor = Number(match[1]);
    else if ((match = quality.match(/^\+(\d+) slots$/))) data.capacity = Number(match[1]);
    else if ((match = quality.match(/^(d\d+(?:\+d\d+)?)(?: damage)?$/))) data.damage = match[1];
    else rest.push(quality);
  }
  return { data, rest };
}

const content = { "cairn-item": [], "cairn-spellbook": [], "cairn-background": [], "cairn-monster": [] };
const prefixes = { "cairn-item": "cairn-item", "cairn-spellbook": "cairn-spellbook", "cairn-background": "cairn-background", "cairn-monster": "cairn-monster" };
const add = (type, name, data) => {
  if (data.description === "") delete data.description;
  // Items always say how many slots they take, so sheet formulas can sum them.
  // Mounts and wagons aren't carried, so they take none.
  if (type === "cairn-item" && data.slots === undefined) data.slots = ["horse", "mule", "wagon"].includes(slugify(name)) ? 0 : 1;
  content[type].push({ name, readableId: `${prefixes[type]}-${slugify(name)}`, data });
};

// Marketplace: armor, weapons, transport, gear, and the two upkeep goods that
// are carried (rations and animal feed). Services and hirelings aren't items.
for (const { heading, body } of sections(read("players-guide/marketplace.md"))) {
  const kind = { Armor: "armor", Weapons: "weapon", Transport: "transport", "Upkeep & Recovery": "gear", Gear: "gear" }[heading];
  if (!kind) continue;
  for (const [entry, cost] of tableRows(body)) {
    const match = entry.match(/^(.+?)\s*\((.+)\)$/);
    const names = match ? match[1] : entry;
    const { data, rest } = itemQualities(match ? splitTop(match[2]) : []);
    if (heading === "Transport" && data.capacity === undefined) continue;
    if (heading === "Upkeep & Recovery" && data.uses === undefined) continue;
    const item = { kind, ...data, cost: Number(cost), description: sentence(rest.join(", ")), source: playersGuide };
    // A weapon row names several weapons that share a profile.
    const list = kind === "weapon" ? names.split(", ").filter((name) => name !== "etc.") : [names];
    for (const name of list) add("cairn-item", name, item);
  }
}

// Reliquary: relics, each a heading with its qualities, then its text and
// recharge as bullets.
for (const { heading, body } of sections(read("wardens-guide/reliquary.md"))) {
  const [first, ...qualities] = splitTop(heading);
  const match = first.match(/^(.+?)\s*\((d\d+(?:\+d\d+)?)\)$/);
  const name = match ? match[1] : first;
  const { data, rest } = itemQualities(qualities);
  if (match) data.damage = match[2];
  if (rest.length) warn(`relic ${name}: unread qualities ${rest.join(", ")}`);
  const lines = body.split("\n").map((line) => line.replace(/^\s*-\s*/, "").trim()).filter(Boolean);
  const recharge = lines.find((line) => line.startsWith("**Recharge**:"));
  add("cairn-item", name, {
    kind: "relic",
    ...data,
    ...(recharge ? { recharge: recharge.replace("**Recharge**:", "").trim() } : {}),
    description: lines.filter((line) => line !== recharge).join("\n\n"),
    source: wardensGuide,
  });
}

// Spellbooks: the d100 table. The italic sentence at the end of a row
// describes the book itself.
for (const [, name, text] of tableRows(read("wardens-guide/spellbooks.md"))) {
  const match = text.match(/^(.*\S)\s+_([^_]+)_(\.?)$/);
  if (!match) warn(`spellbook ${unbold(name)}: no book description`);
  add("cairn-spellbook", unbold(name), {
    effect: match ? match[1] : text,
    ...(match ? { book: match[2] + match[3] } : {}),
    source: wardensGuide,
  });
}

// Backgrounds: one page each, with names, starting gear, and its d6 tables.
for (const file of readdirSync(join(edition, "backgrounds")).filter((name) => name.endsWith(".md")).sort()) {
  const text = read(join("backgrounds", file));
  const name = text.match(/^# (.+)$/m)[1].trim();
  const data = { intro: text.match(/^> (.+)$/m)?.[1].trim(), names: [], startingGear: [], tables: [], source: playersGuide };
  for (const { heading, body } of sections(text)) {
    if (heading === "Names") data.names = body.split(",").map((part) => part.trim()).filter(Boolean);
    else if (heading === "Starting Gear") data.startingGear = body.split("\n").map((line) => line.replace(/^-\s*/, "").trim()).filter(Boolean);
    else {
      const rows = tableRows(body).map((cells) =>
        cells.length === 3 ? { item: unbold(cells[1]), result: cells[2] } : { result: cells[1] },
      );
      if (rows.length !== 6) warn(`background ${name}: "${heading}" has ${rows.length} rows`);
      data.tables.push({ question: heading.replace(/\s*Roll 1d6:?\s*$/, ""), rows });
    }
  }
  add("cairn-background", name, data);
}

// Bestiary: a heading per monster, its stat line, then bullets of notes.
for (const { heading, body } of sections(read("wardens-guide/bestiary.md"))) {
  const [statLine, ...notes] = body.split("\n").filter((line) => line.trim());
  if (!/\d+ HP/.test(statLine ?? "")) continue;
  const data = { hp: 0, armor: 0, str: 0, dex: 0, wil: 0, attacks: [], detachment: false };
  for (const part of splitTop(statLine)) {
    let match;
    if ((match = part.match(/^(\d+) (HP|Armor|STR|DEX|WIL)$/))) data[match[2] === "Armor" ? "armor" : match[2].toLowerCase()] = Number(match[1]);
    else if (part === "_detachment_") data.detachment = true;
    else {
      // "short sword (d6) or short bow (d6)" is two attacks to choose from.
      for (const attack of part.split(" or ")) {
        const parts = attack.match(/^(.+?)\s*\((.+)\)$/);
        if (!parts) {
          warn(`monster ${heading}: unread "${attack}"`);
          continue;
        }
        const [damage, ...qualities] = splitTop(parts[2]);
        const blast = qualities.includes("_blast_");
        const other = qualities.filter((quality) => quality !== "_blast_");
        data.attacks.push({ name: sentence(parts[1]).replace(/\.$/, ""), damage, blast, ...(other.length ? { notes: sentence(other.join(", ")) } : {}) });
      }
    }
  }
  data.description = notes.map((line) => line.replace(/^\s*-\s*/, "- ").trim()).join("\n");
  data.source = wardensGuide;
  add("cairn-monster", heading, data);
}

rmSync(outDir, { recursive: true, force: true });
const seen = new Set();
for (const [type, records] of Object.entries(content)) {
  const dir = new URL(`${type}/`, outDir);
  mkdirSync(dir, { recursive: true });
  for (const record of records) {
    if (seen.has(record.readableId)) warn(`duplicate readable ID ${record.readableId}`);
    seen.add(record.readableId);
    writeFileSync(new URL(`${record.readableId}.json`, dir), JSON.stringify(record, null, 2) + "\n");
  }
  console.log(`${type}: ${records.length}`);
}
for (const message of warnings) console.warn(`warning: ${message}`);
