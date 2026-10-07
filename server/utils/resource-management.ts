import { eq } from "drizzle-orm";
import type { User } from "better-auth";
import { createError } from "h3";
import { group, resource, type Resource } from "../database/schema";
import { useDatabase } from "./database";
import { getResourceSource } from "./resource-list-filter";
import { isUniqueConstraintError } from "./user-profile";
import { loadOwnerReadableId } from "./resource-address";
import type { ForkedFrom } from "../../shared/forked-from";
import {
  canCreateForGroup,
  getResourceAccess,
  getResourceAccessOrPublic,
  loadResourceAccessContext,
  type ResourceAccessContext,
  type ResourceAccessOptions,
} from "./resource-access";

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const readableIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function requireUuid(value: unknown, field: string) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${field} must be a UUID`,
    });
  }
  return value;
}

export function requireReadableId(value: unknown) {
  if (typeof value !== "string") {
    throw createError({ statusCode: 400, statusMessage: "readableId is required" });
  }
  const readableId = value.trim().toLowerCase();
  if (!readableIdPattern.test(readableId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "readableId must use lowercase letters, numbers, and hyphens",
    });
  }
  return readableId;
}

export function requireName(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw createError({ statusCode: 400, statusMessage: "name is required" });
  }
  return value.trim();
}

export const MAX_DESCRIPTION_LENGTH = 20_000;

// A resource's Markdown description: text up to MAX_DESCRIPTION_LENGTH
// characters, or null (or blank text) for none.
export function requireDescription(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw createError({ statusCode: 400, statusMessage: "description must be text or null" });
  }
  if (value.length > MAX_DESCRIPTION_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `description can be at most ${MAX_DESCRIPTION_LENGTH.toLocaleString("en-US")} characters`,
    });
  }
  return value.trim() ? value : null;
}

export async function requireResourceEditor(
  user: Pick<User, "id" | "name">,
  resourceId: string,
  options?: ResourceAccessOptions,
) {
  const database = useDatabase();
  const [item] = await database
    .select()
    .from(resource)
    .where(eq(resource.id, resourceId))
    .limit(1);
  if (!item)
    throw createError({ statusCode: 404, statusMessage: "Resource not found" });

  const context = await loadResourceAccessContext(user, [resourceId]);
  if (!getResourceAccess(item, context, options).canEdit) {
    throw createError({
      statusCode: 403,
      statusMessage: "Resource is not editable",
    });
  }
  return item;
}

export async function requireResourceReader(
  user: Pick<User, "id" | "name"> | null,
  resourceId: string,
) {
  return (await loadReadableResource(user, resourceId)).item;
}

// `requireResourceReader`, also returning the access context it loaded (null
// for an anonymous visitor), for routes that check more than `canEdit`.
export async function loadReadableResource(
  user: Pick<User, "id" | "name"> | null,
  resourceId: string,
) {
  const database = useDatabase();
  const [item] = await database
    .select()
    .from(resource)
    .where(eq(resource.id, resourceId))
    .limit(1);
  if (!item)
    throw createError({ statusCode: 404, statusMessage: "Resource not found" });

  const context = user
    ? await loadResourceAccessContext(user, [resourceId])
    : null;
  const access = getResourceAccessOrPublic(item, context);
  if (!access.canRead) {
    throw createError({ statusCode: 404, statusMessage: "Resource not found" });
  }
  const [ownerReadableId, source, forkedFrom] = await Promise.all([
    loadOwnerReadableId(item),
    loadResourceSource(item, context),
    loadForkedFrom(item, user),
  ]);
  return {
    item: {
      ...item,
      // With `readableId`, the resource's owner + readable ID address.
      ownerReadableId,
      source,
      forkedFrom,
      canEdit: access.canEdit,
      canChangeOwner: !!context && canChangeResourceOwner(item, user!, context),
    },
    context,
  };
}

// The resource a fork was copied from, for the viewer: its name and address
// when they can read it, else only `available: false` (also when it was
// deleted). Null for a resource that isn't a fork.
export async function loadForkedFrom(
  item: Pick<Resource, "forkedFromId">,
  user: Pick<User, "id" | "name"> | null,
): Promise<ForkedFrom> {
  if (!item.forkedFromId) return null;
  const [source] = await useDatabase()
    .select()
    .from(resource)
    .where(eq(resource.id, item.forkedFromId))
    .limit(1);
  const context =
    source && user ? await loadResourceAccessContext(user, [source.id]) : null;
  if (!source || !getResourceAccessOrPublic(source, context).canRead)
    return { id: item.forkedFromId, available: false };
  return {
    id: source.id,
    available: true,
    kind: source.kind,
    name: source.name,
    readableId: source.readableId,
    ownerReadableId: await loadOwnerReadableId(source),
  };
}

// The resource's Source label for the viewer (`getResourceSource`), as list
// rows carry it, for single-resource GETs.
export async function loadResourceSource(
  item: Resource,
  context: ResourceAccessContext | null,
) {
  let official = false;
  if (item.ownerGroupId) {
    if (context) official = context.systemGroupIds.has(item.ownerGroupId);
    else {
      const [owner] = await useDatabase()
        .select({ kind: group.kind })
        .from(group)
        .where(eq(group.id, item.ownerGroupId))
        .limit(1);
      official = owner?.kind === "system";
    }
  }
  return getResourceSource(item, official, context);
}

// Who owns a new resource: the user, or `ownerGroupId` if the user may create
// resources for that group (`canCreateForGroup`).
export async function resolveResourceOwner(
  user: Pick<User, "id" | "name">,
  ownerGroupId: string | null | undefined,
  context?: ResourceAccessContext,
): Promise<{ ownerUserId: string | null; ownerGroupId: string | null }> {
  if (!ownerGroupId) return { ownerUserId: user.id, ownerGroupId: null };
  const access = context ?? (await loadResourceAccessContext(user, []));
  if (!canCreateForGroup(ownerGroupId, access))
    throw createError({
      statusCode: 403,
      statusMessage:
        "Only admins and editors of a group can create resources it owns",
    });
  return { ownerUserId: null, ownerGroupId };
}

type Owned = { ownerUserId: string | null; ownerGroupId: string | null };

// Who may move a resource to another owner: the user who owns it, admins of
// the group that owns it, and site admins. (Group editors may not.)
export function canChangeResourceOwner(
  item: Owned,
  user: Pick<User, "id">,
  context: ResourceAccessContext,
) {
  if (context.isSiteAdmin) return true;
  if (item.ownerGroupId)
    return context.groupRoles.get(item.ownerGroupId) === "admin";
  return item.ownerUserId === user.id;
}

// The new owner columns for a request to move `item` to `requested` (a group
// ID, or null for the acting user), or undefined when nothing changes.
export async function resolveOwnerChange(
  user: Pick<User, "id" | "name">,
  item: Owned,
  requested: unknown,
): Promise<Owned | undefined> {
  if (requested === undefined) return undefined;
  if (requested !== null && !(typeof requested === "string" && uuidPattern.test(requested)))
    throw createError({
      statusCode: 400,
      statusMessage: "ownerGroupId must be a group ID or null",
    });
  const ownerGroupId = requested as string | null;
  if (
    ownerGroupId === item.ownerGroupId &&
    (ownerGroupId !== null || item.ownerUserId === user.id)
  )
    return undefined;
  const context = await loadResourceAccessContext(user, []);
  if (!canChangeResourceOwner(item, user, context))
    throw createError({
      statusCode: 403,
      statusMessage: item.ownerGroupId
        ? "Only admins of the owning group can change who owns this"
        : "Only the owner can change who owns this",
    });
  return resolveResourceOwner(user, ownerGroupId, context);
}

// Readable IDs are unique per owner and kind, so renames and owner changes can
// collide.
export function rethrowReadableIdConflict(error: unknown): never {
  if (isUniqueConstraintError(error))
    throw createError({
      statusCode: 409,
      statusMessage: "The owner already has one of these with that ID",
    });
  throw error;
}
