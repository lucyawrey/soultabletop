import { eq } from "drizzle-orm";
import type { User } from "better-auth";
import { createError } from "h3";
import { resource } from "../database/schema";
import { useDatabase } from "./database";
import {
  getResourceAccess,
  loadResourceAccessContext,
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

export function requireOwnerTarget(
  user: Pick<User, "id">,
  ownerGroupId: string | null,
  groupRoles: Map<string, "admin" | "editor" | "member">,
  isSiteAdmin: boolean,
) {
  if (!ownerGroupId) return { ownerUserId: user.id, ownerGroupId: null };
  const role = groupRoles.get(ownerGroupId);
  if (!isSiteAdmin && role !== "admin" && role !== "editor") {
    throw createError({
      statusCode: 403,
      statusMessage: "Not allowed to create group resources",
    });
  }
  return { ownerUserId: null, ownerGroupId };
}
