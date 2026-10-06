import { createError } from "h3";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { User } from "better-auth";
import { contentType, resource, sheet } from "../database/schema";
import {
  MAX_CONTENT_DEPTH,
  referencedContentTypeIds,
  type ContentTypeRules,
} from "../../shared/content-schema";
import {
  GENERATED_SHEET_NAME,
  generatedSheetDefaults,
  generateSheetMarkup,
  type ContentCategory,
} from "../../shared/sheet/generate";
import { markupHasOwnPreview } from "../../shared/sheet/card";
import { processSheetCss } from "../../shared/sheet/css";
import type { SheetDiagnostic } from "../../shared/sheet/parser";
import type { SheetDisplay } from "../../shared/sheet/registry";
import {
  compileSheet,
  hasErrors,
  newSheetErrors,
  type SheetSchemas,
} from "../../shared/sheet/validate";
import { useDatabase } from "./database";
import {
  getResourceAccess,
  getResourceAccessOrPublic,
  loadResourceAccessContext,
} from "./resource-access";

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
          showSheetWarnings: contentType.showSheetWarnings,
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

export interface ResolvedSheet {
  id: string | null; // null for the generated sheet
  name: string;
  markup: string;
  // Scoped to `[data-sheet="<id>"]`, ready to use.
  css: string;
  source: "selected" | "default" | "generated";
  defaultEditMode: boolean;
  defaultAutosave: boolean;
  defaultDisplay: SheetDisplay;
  canEdit: boolean;
}

// The selected Sheet, or without one the ContentType's default Sheet, with
// the viewer's access to it; undefined when there is none.
async function findSheetWithAccess(
  user: Pick<User, "id" | "name"> | null,
  selectedSheetId: string | null,
  contentTypeId: string,
) {
  const [row] = await useDatabase()
    .select({ sheet, resource })
    .from(sheet)
    .innerJoin(resource, eq(resource.id, sheet.resourceId))
    .where(
      selectedSheetId
        ? eq(sheet.resourceId, selectedSheetId)
        : and(eq(sheet.contentTypeId, contentTypeId), eq(sheet.isDefault, true)),
    )
    .limit(1);
  if (!row) return undefined;
  const context = user ? await loadResourceAccessContext(user, [row.resource.id]) : null;
  return { ...row, access: getResourceAccessOrPublic(row.resource, context) };
}

// The Sheet to render a Content with: its selected Sheet if the viewer can read
// it, else (when none is selected) its ContentType's default Sheet if
// readable, else one generated from the schema.
export async function resolveContentSheet(
  // null: an anonymous visitor, who can read only public Sheets.
  user: Pick<User, "id" | "name"> | null,
  selectedSheetId: string | null,
  contentTypeId: string,
  category: ContentCategory,
  schemas: SheetSchemas,
): Promise<ResolvedSheet> {
  const row = await findSheetWithAccess(user, selectedSheetId, contentTypeId);
  if (row?.access.canRead) {
    return {
      id: row.resource.id,
      name: row.resource.name,
      markup: row.sheet.markup,
      css: processSheetCss(row.sheet.cssStyles, row.resource.id).css,
      source: selectedSheetId ? "selected" : "default",
      defaultEditMode: row.sheet.defaultEditMode,
      defaultAutosave: row.sheet.defaultAutosave,
      defaultDisplay: row.sheet.defaultDisplay,
      canEdit: row.access.canEdit,
    };
  }
  return {
    id: null,
    name: GENERATED_SHEET_NAME,
    markup: generateSheetMarkup(schemas),
    css: "",
    source: "generated",
    ...generatedSheetDefaults(category),
    canEdit: false,
  };
}

export interface PreviewSheet {
  id: string;
  markup: string;
  // Scoped to `[data-sheet="<id>"]`, ready to use.
  css: string;
  defaultDisplay: SheetDisplay;
}

// A ContentType's default Sheet for previews of its content: only when the
// viewer can read it and it has a `<Preview>` beside `<Sheet>` (otherwise
// previews use the generated view, so nothing more is sent).
export async function resolvePreviewSheet(
  user: Pick<User, "id" | "name"> | null,
  contentTypeId: string,
): Promise<PreviewSheet | null> {
  const row = await findSheetWithAccess(user, null, contentTypeId);
  if (!row?.access.canRead || !markupHasOwnPreview(row.sheet.markup)) return null;
  return {
    id: row.resource.id,
    markup: row.sheet.markup,
    css: processSheetCss(row.sheet.cssStyles, row.resource.id).css,
    defaultDisplay: row.sheet.defaultDisplay,
  };
}

function formatDiagnostics(diagnostics: SheetDiagnostic[], where = "line") {
  return diagnostics
    .filter((item) => item.severity === "error")
    .map((item) => ({
      path: `${where} ${item.loc.start.line}:${item.loc.start.column}`,
      message: item.message,
      code: item.code,
      loc: item.loc,
    }));
}

// Rejects Sheet CSS with errors (see shared/sheet/css.ts) with a 400.
export function assertValidSheetCss(css: string) {
  const { diagnostics } = processSheetCss(css);
  if (hasErrors(diagnostics)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Sheet CSS has errors",
      data: formatDiagnostics(diagnostics, "CSS line"),
    });
  }
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
    throw createError({ statusCode: 404, statusMessage: "Content type not found" });
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

export interface BrokenSheets {
  // Broken Sheets `user` can read, with details.
  sheets: BrokenSheet[];
  // How many more broken Sheets `user` can't read (no details given).
  hiddenCount: number;
}

// Sheets that would gain errors if `contentTypeId` had `rules` instead of its
// stored schema: Sheets of that ContentType and of ContentTypes that reach it
// through `content` fields. Only Sheets `user` can read are described; others
// (which may belong to anyone) are only counted.
export async function findSheetsBrokenBy(
  user: Pick<User, "id" | "name">,
  contentTypeId: string,
  rules: ContentTypeRules,
): Promise<BrokenSheets> {
  const typeIds = await contentTypesReaching(contentTypeId);
  const sheets = await useDatabase()
    .select({
      resource,
      contentTypeId: sheet.contentTypeId,
      markup: sheet.markup,
    })
    .from(sheet)
    .innerJoin(resource, eq(resource.id, sheet.resourceId))
    .where(inArray(sheet.contentTypeId, typeIds));
  const context = await loadResourceAccessContext(
    user,
    sheets.map((item) => item.resource.id),
  );

  const broken: BrokenSheet[] = [];
  let hiddenCount = 0;
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
    const added = newSheetErrors(item.markup, pair[0], pair[1]);
    if (!added.length) continue;
    if (!getResourceAccess(item.resource, context).canRead) {
      hiddenCount += 1;
    } else {
      broken.push({
        id: item.resource.id,
        name: item.resource.name,
        contentTypeId: item.contentTypeId,
        errors: added.slice(0, 3).map(
          (diagnostic) =>
            `line ${diagnostic.loc.start.line}: ${diagnostic.message}`,
        ),
      });
    }
  }
  return { sheets: broken, hiddenCount };
}

// Before a Sheet becomes its ContentType's default, the caller must confirm
// replacing a current (hand-made) default: without `confirmed`, throws a 409
// naming it, or not naming it if `user` can't read it. No default Sheet row
// means the generated sheet is the default, which needs no confirmation.
export async function assertDefaultReplacementConfirmed(
  user: Pick<User, "id" | "name">,
  contentTypeId: string,
  sheetId: string | undefined,
  confirmed: boolean | undefined,
) {
  if (confirmed) return;
  const [current] = await useDatabase()
    .select({ resource })
    .from(sheet)
    .innerJoin(resource, eq(resource.id, sheet.resourceId))
    .where(
      and(eq(sheet.contentTypeId, contentTypeId), eq(sheet.isDefault, true)),
    )
    .limit(1);
  if (!current || current.resource.id === sheetId) return;
  const [type] = await useDatabase()
    .select({ name: resource.name })
    .from(resource)
    .where(eq(resource.id, contentTypeId));
  const context = await loadResourceAccessContext(user, [current.resource.id]);
  const readable = getResourceAccess(current.resource, context).canRead;
  const typeName = type ? `"${type.name}"` : "this content type";
  throw createError({
    statusCode: 409,
    statusMessage: readable
      ? `This replaces "${current.resource.name}" as the default sheet for ${typeName}`
      : `This replaces a sheet you can't view as the default sheet for ${typeName}`,
    data: {
      currentDefaultSheet: readable
        ? { id: current.resource.id, name: current.resource.name }
        : null,
    },
  });
}
