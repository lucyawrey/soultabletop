import { eq } from "drizzle-orm";
import type { User } from "better-auth";
import { createError } from "h3";
import { group, resource } from "../database/schema";
import { useDatabase } from "./database";
import {
  getResourceAccess,
  getResourceAccessOrPublic,
  loadResourceAccessContext,
  type ResourceAccessContext,
} from "./resource-access";

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function requireUuid(value: unknown, field: string) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${field} must be a UUID`,
    });
  }
  return value;
}

export function requireSlug(value: unknown) {
  if (typeof value !== "string") {
    throw createError({ statusCode: 400, statusMessage: "slug is required" });
  }
  const slug = value.trim().toLowerCase();
  if (!slugPattern.test(slug)) {
    throw createError({
      statusCode: 400,
      statusMessage: "slug must use lowercase letters, numbers, and hyphens",
    });
  }
  return slug;
}

export function requireName(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw createError({ statusCode: 400, statusMessage: "name is required" });
  }
  return value.trim();
}

export async function requireResourceEditor(
  user: Pick<User, "id" | "name">,
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

  const context = await loadResourceAccessContext(user, [resourceId]);
  if (!getResourceAccess(item, context).canEdit) {
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
  const database = useDatabase();
  const [item] = await database
    .select()
    .from(resource)
    .where(eq(resource.id, resourceId))
    .limit(1);
  if (!item)
    throw createError({ statusCode: 404, statusMessage: "Resource not found" });

  const access = getResourceAccessOrPublic(
    item,
    user ? await loadResourceAccessContext(user, [resourceId]) : null,
  );
  if (!access.canRead) {
    throw createError({ statusCode: 404, statusMessage: "Resource not found" });
  }
  return { ...item, canEdit: access.canEdit };
}

// Who owns a new resource: the user, or `ownerGroupId` if the user may create
// resources for that group (its admins and editors, or site admins).
export async function resolveResourceOwner(
  user: Pick<User, "id" | "name">,
  ownerGroupId: string | null | undefined,
  context?: ResourceAccessContext,
): Promise<{ ownerUserId: string | null; ownerGroupId: string | null }> {
  if (!ownerGroupId) return { ownerUserId: user.id, ownerGroupId: null };
  const access = context ?? (await loadResourceAccessContext(user, []));
  const role = access.groupRoles.get(ownerGroupId);
  if (!access.isSiteAdmin && role !== "admin" && role !== "editor")
    throw createError({
      statusCode: 403,
      statusMessage:
        "Only admins and editors of a group can create resources it owns",
    });
  if (!role) {
    // A site admin outside the group: make sure it exists.
    const [row] = await useDatabase()
      .select({ id: group.id })
      .from(group)
      .where(eq(group.id, ownerGroupId));
    if (!row)
      throw createError({ statusCode: 404, statusMessage: "Group not found" });
  }
  return { ownerUserId: null, ownerGroupId };
}
