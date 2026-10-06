// Creates a test setup for a Sheet feature (a system, a content type, a
// sheet, and one character) through the API, and deletes it again. For
// browser checks and for the user's test sheets (see
// .claude/running-commands.md).
//
// A spec is a module exporting `markup`, `schema`, and `data`, and optionally
// `name` (the feature, for "Test: <name>") and `sheet` (extra sheet fields,
// e.g. { defaultEditMode: true }).
//
// As the user, with SOUL_TABLETOP_API_KEY, against a dev server running the
// branch (production's code may reject new markup):
//   node --env-file=<main checkout>/.env.local .claude/scripts/test-sheet.mjs create <spec.mjs> [--base http://localhost:3005]
//   node --env-file=<main checkout>/.env.local .claude/scripts/test-sheet.mjs delete <path> ... [--base …]
// `create` prints the character's page and the `delete` arguments (put them
// in the handoff). Vercel previews refuse API keys (401), so use a dev
// server for both. In zsh, pass the paths as separate words (not one
// quoted variable). In a script with a throwaway user, import
// `createTestSheet(request, spec)` and `deleteTestSheet(request, paths)` with
// withSmokeUser's `request`.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export async function createTestSheet(request, spec) {
  const suffix = Date.now().toString(36);
  const title = `Test: ${spec.name ?? "sheet"}`;
  const slug = (spec.name ?? "sheet").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const paths = [];
  const post = async (path, body) => {
    const response = await request(path, { method: "POST", body: JSON.stringify(body) });
    const json = await response.json();
    if (!response.ok) throw new Error(`${path} ${response.status} ${JSON.stringify(json)}`);
    paths.unshift(`${path}/${json.id}`);
    return json;
  };
  try {
    const system = await post("/api/system", { name: title, readableId: `test-${slug}-${suffix}` });
    const type = await post("/api/content-type", {
      name: "Test character",
      readableId: `test-character-${suffix}`,
      systemId: system.id,
      contentCategory: "playerCharacter",
      hasStrictSchema: true,
      schema: spec.schema,
    });
    const sheet = await post("/api/sheet", {
      name: title,
      readableId: `test-${slug}-${suffix}`,
      contentTypeId: type.id,
      markup: spec.markup,
      isDefault: true,
      defaultEditMode: false,
      defaultAutosave: false,
      defaultDisplay: "box",
      ...spec.sheet,
    });
    const content = await post("/api/content", {
      name: spec.characterName ?? "Test character",
      readableId: `test-pc-${suffix}`,
      contentTypeId: type.id,
      sheetId: sheet.id,
      data: spec.data,
    });
    // Deleted in this order: content, sheet, content type, system.
    return { contentId: content.id, page: `/characters/${content.id}`, paths };
  } catch (error) {
    await deleteTestSheet(request, paths);
    throw error;
  }
}

// Returns how many couldn't be deleted (a 404 counts as deleted).
export async function deleteTestSheet(request, paths) {
  let failed = 0;
  for (const path of paths) {
    const response = await request(path, { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      failed += 1;
      console.error(`Couldn't delete ${path}: ${response.status}`);
    }
  }
  return failed;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  const base = baseIndex >= 0 ? args.splice(baseIndex, 2)[1] : "http://localhost:3005";
  const [command, ...rest] = args;
  const key = process.env.SOUL_TABLETOP_API_KEY;
  if (!key) throw new Error("SOUL_TABLETOP_API_KEY isn't set (run with --env-file=<main checkout>/.env.local)");
  const request = (path, init = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: { "content-type": "application/json", "x-api-key": key, ...init.headers },
    });
  if (command === "create") {
    const spec = await import(pathToFileURL(resolve(rest[0])).href);
    const created = await createTestSheet(request, spec);
    console.log(`Character: ${created.page}`);
    console.log(`Delete with: delete ${created.paths.join(" ")}`);
  } else if (command === "delete") {
    const failed = await deleteTestSheet(request, rest);
    if (failed) process.exit(1);
    console.log(`Deleted ${rest.length} resources (or they were already gone).`);
  } else {
    console.error("Usage: test-sheet.mjs create <spec.mjs> | delete <path> ... [--base <url>]");
    process.exit(1);
  }
}
