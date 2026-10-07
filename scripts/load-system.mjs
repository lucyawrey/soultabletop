// Loads a system defined as files (systems/<system>/) into the app through
// its API, creating what doesn't exist yet and updating what does, matched by
// owner + readable ID. Rerunnable, for example after a database reset.
//   node --env-file=.env.local scripts/load-system.mjs systems/pf2e [--url http://localhost:3000]
// Authenticates with SOUL_TABLETOP_API_KEY (a read-write key). The folder:
//   system.json                  { name, readableId, owner?, isPubliclyReadable?, description? }
//   content-types/<id>.json      { name, readableId, contentCategory, hasStrictSchema, schema }
//   content/<type>/<id>.json     { name, readableId, data }
// `owner` is a group's readable ID (else the key's user owns everything), and
// every resource takes the system's visibility. In the files, references are
// readable IDs: a content field's `contentTypeId` names a type, and a content
// field's value names content; the loader swaps in the real IDs. Content is
// created first without its references, then updated with them, so content
// can reference content in any order. The start of the authoring CLI
// (TODO.md, "Authoring CLI for uploading resources from files").
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const dir = args.find((arg) => !arg.startsWith("--"));
const urlIndex = args.indexOf("--url");
const base = (urlIndex >= 0 ? args[urlIndex + 1] : "http://localhost:3000").replace(/\/$/, "");
const apiKey = process.env.SOUL_TABLETOP_API_KEY;
if (!dir || !apiKey) {
  console.error("Usage: node --env-file=.env.local scripts/load-system.mjs <system folder> [--url <app URL>] (needs SOUL_TABLETOP_API_KEY)");
  process.exit(1);
}
const root = resolve(dir);
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const jsonFiles = (path) => {
  try {
    return readdirSync(path).filter((name) => name.endsWith(".json")).map((name) => join(path, name));
  } catch {
    return [];
  }
};

let failures = 0;
async function api(method, path, body) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { "x-api-key": apiKey, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (response.status === 404 && method === "GET") return null;
  if (!response.ok) {
    const detail = json?.data ? ` ${JSON.stringify(json.data).slice(0, 500)}` : "";
    throw new Error(`${method} ${path}: ${response.status} ${json?.statusMessage ?? text.slice(0, 200)}${detail}`);
  }
  return json;
}
// Runs one resource's step, reporting a failure without stopping the rest.
async function step(label, run) {
  try {
    return await run();
  } catch (error) {
    failures++;
    console.error(`failed: ${label}: ${error.message}`);
    return undefined;
  }
}

const system = readJson(join(root, "system.json"));
const visibility = { isPubliclyReadable: system.isPubliclyReadable === true };

// The owner: a group by readable ID, or the key's user.
let ownerGroupId;
let owner;
if (system.owner) {
  const groups = await api("GET", "/group");
  const group = groups.find((item) => item.readableId === system.owner);
  if (!group) throw new Error(`No group "${system.owner}" that this key can create resources for`);
  ownerGroupId = group.id;
  owner = system.owner;
} else {
  owner = (await api("GET", "/profile")).username;
}
const ownerFields = ownerGroupId ? { ownerGroupId } : {};

// The system.
let systemRecord = await api("GET", `/system/${owner}/${system.readableId}`);
if (!systemRecord)
  systemRecord = await api("POST", "/system", { name: system.name, readableId: system.readableId, ...ownerFields, ...visibility });
await api("PATCH", `/system/${systemRecord.id}`, { name: system.name, description: system.description ?? null, ...visibility });
console.log(`system ${owner}/${system.readableId}`);

// Content types, each after the types its content fields point at.
const types = new Map(jsonFiles(join(root, "content-types")).map((path) => {
  const type = readJson(path);
  return [type.readableId, type];
}));
const referencedTypes = (schema) => [...JSON.stringify(schema).matchAll(/"contentTypeId":"([^"]+)"/g)].map((match) => match[1]);
const typeIds = new Map();
const typeOrder = [];
const visit = (readableId, seen = new Set()) => {
  if (typeOrder.includes(readableId) || seen.has(readableId) || !types.has(readableId)) return;
  seen.add(readableId);
  for (const target of referencedTypes(types.get(readableId).schema)) if (target !== readableId) visit(target, seen);
  typeOrder.push(readableId);
};
for (const readableId of types.keys()) visit(readableId);

for (const readableId of typeOrder) {
  const type = types.get(readableId);
  await step(`content type ${readableId}`, async () => {
    const schema = JSON.parse(
      JSON.stringify(type.schema).replace(/"contentTypeId":"([^"]+)"/g, (match, target) => {
        const id = typeIds.get(target);
        if (!id) throw new Error(`references the content type ${target}, which isn't loaded`);
        return `"contentTypeId":"${id}"`;
      }),
    );
    const fields = { name: type.name, contentCategory: type.contentCategory, hasStrictSchema: type.hasStrictSchema, schema, ...visibility };
    const existing = await api("GET", `/content-type/${owner}/${readableId}`);
    const record = existing
      ? await api("PATCH", `/content-type/${existing.id}`, fields)
      : await api("POST", "/content-type", { ...fields, readableId, systemId: systemRecord.id, ...ownerFields });
    typeIds.set(readableId, record.id ?? existing.id);
  });
}
console.log(`${typeIds.size} of ${types.size} content types`);

// Content: the content fields of a schema hold readable IDs in the files.
// `strip` removes them (for the first pass), `resolveRefs` swaps in IDs.
function mapRefs(schema, data, onRef) {
  const out = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    const field = schema[key];
    const mapped = field ? mapValue(field, value, onRef) : value;
    if (mapped !== undefined) out[key] = mapped;
  }
  return out;
}
function mapValue(field, value, onRef) {
  if (value === null || value === undefined) return value;
  if (field.type === "content") return typeof value === "string" ? onRef(value) : value;
  if (field.type === "array" && Array.isArray(value))
    return value.map((item) => mapValue(field.itemType, item, onRef)).filter((item) => item !== undefined);
  if (field.type === "struct" && typeof value === "object") return mapRefs(field.entries, value, onRef);
  return value;
}

const contentIds = new Map();
const contentFiles = [];
for (const typeDir of readdirSync(join(root, "content"), { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  const type = types.get(typeDir.name);
  if (!type || !typeIds.has(typeDir.name)) {
    failures++;
    console.error(`failed: content/${typeDir.name}: no loaded content type with that readable ID`);
    continue;
  }
  for (const path of jsonFiles(join(root, "content", typeDir.name))) contentFiles.push({ type, typeId: typeIds.get(typeDir.name), file: readJson(path) });
}

// First pass: create what's missing, without references.
for (const { type, typeId, file } of contentFiles) {
  await step(`content ${file.readableId}`, async () => {
    const existing = await api("GET", `/content/${owner}/${file.readableId}`);
    if (existing) {
      contentIds.set(file.readableId, existing.id);
      return;
    }
    const data = mapRefs(type.schema, file.data, () => undefined);
    const record = await api("POST", "/content", { name: file.name, readableId: file.readableId, contentTypeId: typeId, data, ...ownerFields, ...visibility });
    contentIds.set(file.readableId, record.id);
  });
}
// Second pass: every item's full data, with its references.
let updated = 0;
for (const { type, file } of contentFiles) {
  const id = contentIds.get(file.readableId);
  if (!id) continue;
  await step(`content ${file.readableId}`, async () => {
    const data = mapRefs(type.schema, file.data, (readableId) => {
      const target = contentIds.get(readableId);
      if (!target) throw new Error(`references ${readableId}, which isn't loaded`);
      return target;
    });
    await api("PATCH", `/content/${id}`, { name: file.name, data, ...visibility });
    updated++;
  });
}
console.log(`${updated} of ${contentFiles.length} content items`);
if (failures) {
  console.error(`${failures} failed`);
  process.exit(1);
}
