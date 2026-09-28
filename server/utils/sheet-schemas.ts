import { createError } from "h3";
import { eq, inArray, sql } from "drizzle-orm";
import { contentType, resource, sheet } from "../database/schema";
import {
  MAX_CONTENT_DEPTH,
  referencedContentTypeIds,
  type ContentTypeRules,
} from "../../shared/content-schema";
import type { SheetDiagnostic } from "../../shared/sheet/parser";
import {
  compileSheet,
  hasErrors,
  type SheetSchemas,
} from "../../shared/sheet/validate";
import { useDatabase } from "./database";

// Loads a ContentType's rules plus those of every ContentType reachable
// through `content` fields, up to MAX_CONTENT_DEPTH hops. `overrides` replaces
// stored rules (e.g. a schema that is about to be saved).
export async function loadSheetSchemas(
  contentTypeId: string,
  overrides: Record<string, ContentTypeRules> = {},
): Promise<SheetSchemas | undefined> {
  const loaded = new Map<string, ContentTypeRules>(Object.entries(overrides));
  const visited = new Set<string>();
  // Breadth-first: depth 0 is the Sheet's own ContentType.
  let pending = [contentTypeId];
  for (let depth = 0; depth <= MAX_CONTENT_DEPTH && pending.length; depth += 1) {
    const missing = pending.filter((id) => !loaded.has(id));
    if (missing.length) {
      const rows = await useDatabase()
        .select({
          id: contentType.resourceId,
          schema: contentType.schema,
          hasStrictSchema: contentType.hasStrictSchema,
        })
        .from(contentType)
        .where(inArray(contentType.resourceId, missing));
      for (const row of rows) loaded.set(row.id, row);
    }
    const next = new Set<string>();
    for (const id of pending) {
      visited.add(id);
      const rules = loaded.get(id);
      if (rules) referencedContentTypeIds(rules.schema, next);
    }
    pending = [...next].filter((id) => !visited.has(id));
  }

  const root = loaded.get(contentTypeId);
  if (!root) return undefined;
  return { root, types: Object.fromEntries(loaded) };
}

function formatDiagnostics(diagnostics: SheetDiagnostic[]) {
  return diagnostics
    .filter((item) => item.severity === "error")
    .map((item) => ({
      path: `line ${item.loc.start.line}:${item.loc.start.column}`,
      message: item.message,
      code: item.code,
      loc: item.loc,
    }));
}

// Rejects Sheet markup with errors (warnings are allowed) with a 400 listing
// them, in the `data` format `extractApiErrorMessage` understands.
export async function assertValidSheetMarkup(
  markup: string,
  contentTypeId: string,
) {
  if (!markup.trim()) return;
  const schemas = await loadSheetSchemas(contentTypeId);
  if (!schemas)
    throw createError({ statusCode: 404, statusMessage: "ContentType not found" });
  const { diagnostics } = compileSheet(markup, schemas);
  if (hasErrors(diagnostics)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Sheet markup has errors",
      data: formatDiagnostics(diagnostics),
    });
  }
}

// ContentTypes whose Sheets can reach `contentTypeId` through `content`
// fields (including itself), up to MAX_CONTENT_DEPTH hops away.
async function contentTypesReaching(contentTypeId: string) {
  const found = new Set([contentTypeId]);
  let frontier = [contentTypeId];
  for (let depth = 0; depth < MAX_CONTENT_DEPTH && frontier.length; depth += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      // The schema is json text; a cheap substring match finds candidates,
      // then the parsed schema confirms them.
      const rows = await useDatabase()
        .select({ id: contentType.resourceId, schema: contentType.schema })
        .from(contentType)
        .where(sql`${contentType.schema}::text like ${`%${id}%`}`);
      for (const row of rows) {
        if (found.has(row.id)) continue;
        if (!referencedContentTypeIds(row.schema).has(id)) continue;
        found.add(row.id);
        next.push(row.id);
      }
    }
    frontier = next;
  }
  return [...found];
}

export interface BrokenSheet {
  id: string;
  name: string;
  contentTypeId: string;
  errors: string[];
}

// Sheets that would gain errors if `contentTypeId` had `rules` instead of its
// stored schema: Sheets of that ContentType and of ContentTypes that reach it
// through `content` fields.
export async function findSheetsBrokenBy(
  contentTypeId: string,
  rules: ContentTypeRules,
): Promise<BrokenSheet[]> {
  const typeIds = await contentTypesReaching(contentTypeId);
  const sheets = await useDatabase()
    .select({
      id: sheet.resourceId,
      name: resource.name,
      contentTypeId: sheet.contentTypeId,
      markup: sheet.markup,
    })
    .from(sheet)
    .innerJoin(resource, eq(resource.id, sheet.resourceId))
    .where(inArray(sheet.contentTypeId, typeIds));

  const broken: BrokenSheet[] = [];
  const schemaCache = new Map<string, [SheetSchemas, SheetSchemas] | undefined>();
  for (const item of sheets) {
    if (!item.markup.trim()) continue;
    if (!schemaCache.has(item.contentTypeId)) {
      const before = await loadSheetSchemas(item.contentTypeId);
      const after = await loadSheetSchemas(item.contentTypeId, {
        [contentTypeId]: rules,
      });
      schemaCache.set(item.contentTypeId, before && after ? [before, after] : undefined);
    }
    const pair = schemaCache.get(item.contentTypeId);
    if (!pair) continue;
    const errorsBefore = compileSheet(item.markup, pair[0]).diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error",
    );
    const errorsAfter = compileSheet(item.markup, pair[1]).diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error",
    );
    const known = new Set(errorsBefore.map((diagnostic) => diagnostic.message));
    const added = errorsAfter.filter((diagnostic) => !known.has(diagnostic.message));
    if (added.length) {
      broken.push({
        id: item.id,
        name: item.name,
        contentTypeId: item.contentTypeId,
        errors: added.slice(0, 3).map(
          (diagnostic) =>
            `line ${diagnostic.loc.start.line}: ${diagnostic.message}`,
        ),
      });
    }
  }
  return broken;
}
