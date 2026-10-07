import { randomUUID } from "node:crypto";
import { createError } from "h3";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { User } from "better-auth";
import {
  contentType,
  resource,
  sheet,
  system,
  type Resource,
} from "../database/schema";
import { useDatabase } from "./database";
import { getResourceAccess, loadResourceAccessContext } from "./resource-access";
import {
  loadReadableResource,
  resolveResourceOwner,
  rethrowReadableIdConflict,
} from "./resource-management";
import { remapContentTypeIds } from "../../shared/content-schema";

// Forks ("make my own copy", `.claude/plans/fork-resources.md` on `docs`):
// copy a system, content type, or sheet the user can read into their own
// account, with its parents (sheet → content type → system) and with chosen
// resources below the topmost copy. Parents and extras come only from the
// forked resource's owner. Each copy records its immediate source in
// `forkedFromId`; references among copies are pointed at the copies, the
// rest stay on the originals. Content is never copied.

export const FORKABLE_KINDS = ["system", "contentType", "sheet"] as const;
export type ForkableKind = (typeof FORKABLE_KINDS)[number];

export function isForkableKind(kind: string): kind is ForkableKind {
  return (FORKABLE_KINDS as readonly string[]).includes(kind);
}

// A resource the fork can copy. `parentId`: the system of a content type, the
// content type of a sheet.
export interface ForkCandidate {
  id: string;
  kind: ForkableKind;
  name: string;
  readableId: string;
  parentId: string | null;
}

export interface ForkOptions {
  resource: ForkCandidate;
  // Upward from the resource's parent, stopping at the first parent with
  // another owner or that the user can't read.
  parents: ForkCandidate[];
  // Readable resources below the topmost parent (or the resource itself),
  // with the same owner, not in the chain: content types before sheets.
  extras: ForkCandidate[];
}

type Owned = Pick<Resource, "ownerUserId" | "ownerGroupId">;

function sameOwner(a: Owned, b: Owned) {
  return a.ownerUserId === b.ownerUserId && a.ownerGroupId === b.ownerGroupId;
}

// Resources owned by `item`'s owner (a resource has exactly one owner).
function ownerCondition(item: Owned) {
  return item.ownerGroupId
    ? eq(resource.ownerGroupId, item.ownerGroupId)
    : eq(resource.ownerUserId, item.ownerUserId!);
}

function candidate(item: Resource, parentId: string | null): ForkCandidate {
  return {
    id: item.id,
    kind: item.kind as ForkableKind,
    name: item.name,
    readableId: item.readableId,
    parentId,
  };
}

async function loadParentId(item: Resource) {
  const database = useDatabase();
  if (item.kind === "sheet") {
    const [row] = await database
      .select({ id: sheet.contentTypeId })
      .from(sheet)
      .where(eq(sheet.resourceId, item.id));
    return row?.id ?? null;
  }
  if (item.kind === "contentType") {
    const [row] = await database
      .select({ id: contentType.systemId })
      .from(contentType)
      .where(eq(contentType.resourceId, item.id));
    return row?.id ?? null;
  }
  return null;
}

export async function loadForkOptions(
  user: Pick<User, "id" | "name">,
  resourceId: string,
): Promise<ForkOptions> {
  const { item } = await loadReadableResource(user, resourceId);
  if (!isForkableKind(item.kind))
    throw createError({
      statusCode: 400,
      statusMessage: "Only systems, content types, and sheets can be forked",
    });
  const database = useDatabase();
  const root = candidate(item, await loadParentId(item));

  const parents: ForkCandidate[] = [];
  let top: ForkCandidate = root;
  for (let parentId = root.parentId; parentId; ) {
    const [parent] = await database.select().from(resource).where(eq(resource.id, parentId));
    if (!parent || !sameOwner(parent, item)) break;
    const context = await loadResourceAccessContext(user, [parent.id]);
    if (!getResourceAccess(parent, context).canRead) break;
    top = candidate(parent, await loadParentId(parent));
    parents.push(top);
    parentId = top.parentId;
  }

  const chainIds = new Set([root.id, ...parents.map((parent) => parent.id)]);
  const below: { item: Resource; parentId: string }[] = [];
  if (top.kind === "system") {
    const types = await database
      .select({ item: resource, parentId: contentType.systemId })
      .from(contentType)
      .innerJoin(resource, eq(resource.id, contentType.resourceId))
      .where(and(eq(contentType.systemId, top.id), ownerCondition(item)))
      .orderBy(sql`lower(${resource.name})`);
    below.push(...types);
  }
  const typeIds = top.kind === "sheet" ? [] : [
    ...(top.kind === "contentType" ? [top.id] : []),
    ...below.map((row) => row.item.id),
  ];
  if (typeIds.length > 0) {
    const sheets = await database
      .select({ item: resource, parentId: sheet.contentTypeId })
      .from(sheet)
      .innerJoin(resource, eq(resource.id, sheet.resourceId))
      .where(and(inArray(sheet.contentTypeId, typeIds), ownerCondition(item)))
      .orderBy(sql`lower(${resource.name})`);
    below.push(...sheets);
  }
  const context = await loadResourceAccessContext(
    user,
    below.map((row) => row.item.id),
  );
  const extras = below
    .filter((row) => !chainIds.has(row.item.id))
    .filter((row) => getResourceAccess(row.item, context).canRead)
    .map((row) => candidate(row.item, row.parentId));
  return { resource: root, parents, extras };
}

export interface ForkRequest {
  ownerGroupId?: string | null;
  withParents?: boolean;
  include?: string[];
}

export interface ForkCopy {
  id: string;
  kind: ForkableKind;
  forkedFromId: string;
}

const KIND_ORDER: Record<ForkableKind, number> = { system: 0, contentType: 1, sheet: 2 };

// The resources a fork request copies, parents first: the resource, its
// parents if asked, and the requested extras, each of which needs its parent
// copied too.
export function selectForkCopies(options: ForkOptions, request: ForkRequest) {
  const selected = [options.resource, ...(request.withParents ? options.parents : [])];
  const copied = new Set(selected.map((item) => item.id));
  const include = new Set(request.include ?? []);
  for (const id of include) {
    if (!options.extras.some((extra) => extra.id === id))
      throw createError({
        statusCode: 400,
        statusMessage: "include lists a resource this fork can't copy",
      });
  }
  // Extras are ordered content types before sheets, so a sheet's type is
  // decided before the sheet.
  for (const extra of options.extras) {
    if (!include.has(extra.id)) continue;
    if (!extra.parentId || !copied.has(extra.parentId))
      throw createError({
        statusCode: 400,
        statusMessage: `${extra.name} can only be copied with its parent`,
      });
    selected.push(extra);
    copied.add(extra.id);
  }
  return selected.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

// The first of `readableId`, `readableId-2`, `readableId-3`, … not in `taken`.
export function freeReadableId(readableId: string, taken: ReadonlySet<string>) {
  if (!taken.has(readableId)) return readableId;
  for (let suffix = 2; ; suffix++) {
    const next = `${readableId}-${suffix}`;
    if (!taken.has(next)) return next;
  }
}

export async function forkResource(
  user: Pick<User, "id" | "name">,
  resourceId: string,
  request: ForkRequest,
): Promise<ForkCopy[]> {
  const options = await loadForkOptions(user, resourceId);
  const selected = selectForkCopies(options, request);
  const owner = await resolveResourceOwner(user, request.ownerGroupId);
  const idMap = new Map(selected.map((item) => [item.id, randomUUID()]));
  const database = useDatabase();
  const ids = selected.map((item) => item.id);
  const [sources, types, sheets] = await Promise.all([
    database.select().from(resource).where(inArray(resource.id, ids)),
    database.select().from(contentType).where(inArray(contentType.resourceId, ids)),
    database.select().from(sheet).where(inArray(sheet.resourceId, ids)),
  ]);
  const sourceById = new Map(sources.map((row) => [row.id, row]));
  const typeById = new Map(types.map((row) => [row.resourceId, row]));
  const sheetById = new Map(sheets.map((row) => [row.resourceId, row]));

  try {
    return await database.transaction(async (tx) => {
      const copies: ForkCopy[] = [];
      const takenByKind = new Map<ForkableKind, Set<string>>();
      for (const item of selected) {
        const source = sourceById.get(item.id);
        if (!source) throw createError({ statusCode: 404, statusMessage: "Resource not found" });
        let taken = takenByKind.get(item.kind);
        if (!taken) {
          const rows = await tx
            .select({ readableId: resource.readableId })
            .from(resource)
            .where(and(ownerCondition(owner), eq(resource.kind, item.kind)));
          taken = new Set(rows.map((row) => row.readableId.toLowerCase()));
          takenByKind.set(item.kind, taken);
        }
        const readableId = freeReadableId(source.readableId, taken);
        taken.add(readableId);
        const id = idMap.get(item.id)!;
        await tx.insert(resource).values({
          id,
          kind: item.kind,
          ...owner,
          readableId,
          name: source.name,
          description: source.description,
          forkedFromId: source.id,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        });
        if (item.kind === "system") {
          await tx.insert(system).values({ resourceId: id });
        } else if (item.kind === "contentType") {
          const type = typeById.get(item.id)!;
          await tx.insert(contentType).values({
            resourceId: id,
            systemId: idMap.get(type.systemId) ?? type.systemId,
            contentCategory: type.contentCategory,
            hasStrictSchema: type.hasStrictSchema,
            showSheetWarnings: type.showSheetWarnings,
            schema: remapContentTypeIds(type.schema, idMap),
          });
        } else {
          const source = sheetById.get(item.id)!;
          const copiedType = idMap.get(source.contentTypeId);
          await tx.insert(sheet).values({
            resourceId: id,
            contentTypeId: copiedType ?? source.contentTypeId,
            markup: source.markup,
            cssStyles: source.cssStyles,
            // The default sheet belongs to its content type: a copy keeps it
            // only on a copied type.
            isDefault: source.isDefault && !!copiedType,
            defaultEditMode: source.defaultEditMode,
            defaultAutosave: source.defaultAutosave,
            defaultDisplay: source.defaultDisplay,
          });
        }
        copies.push({ id, kind: item.kind, forkedFromId: source.id });
      }
      return copies;
    });
  } catch (error) {
    rethrowReadableIdConflict(error);
  }
}
