import { createError, getQuery } from "h3";
import { and, eq, ne, sql } from "drizzle-orm";
import { group, resource } from "../database/schema";
import { requireAuthenticatedUser } from "../utils/auth";
import { useDatabase } from "../utils/database";
import { parseAvailabilityQuery } from "../utils/readable-id-availability";
import {
  requireResourceEditor,
  resolveResourceOwner,
} from "../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["Resource"],
    summary: "Check readable ID availability",
    description:
      "Whether a readable ID is free for a resource kind under an owner, or among groups. Resource readable IDs are unique per owner and kind; group readable IDs are unique among groups. Only answers for owners the caller could create resources for.",
    parameters: [
      {
        name: "kind",
        in: "query",
        required: true,
        schema: {
          type: "string",
          enum: ["system", "campaign", "contentType", "sheet", "content", "group"],
        },
      },
      { name: "readableId", in: "query", required: true, schema: { type: "string" } },
      {
        name: "owner",
        in: "query",
        required: false,
        description:
          "`me` or a group ID the caller can create resources for. Left out: the owner of `resourceId`, or the caller. Not for groups.",
        schema: { type: "string" },
      },
      {
        name: "resourceId",
        in: "query",
        required: false,
        description:
          "The resource (which the caller must be able to edit) or group being edited; its own ID counts as available.",
        schema: { type: "string", format: "uuid" },
      },
    ],
    responses: {
      200: { description: "`{ available: boolean }`" },
      400: { description: "Invalid query" },
      401: { description: "Authentication required" },
      403: { description: "The caller cannot create resources for that owner" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const parsed = parseAvailabilityQuery(getQuery(event));
  if ("error" in parsed)
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  const { kind, readableId, owner, resourceId } = parsed.query;
  const database = useDatabase();

  if (kind === "group") {
    const [taken] = await database
      .select({ id: group.id })
      .from(group)
      .where(
        and(
          sql`lower(${group.readableId}) = ${readableId}`,
          resourceId ? ne(group.id, resourceId) : undefined,
        ),
      )
      .limit(1);
    return { available: !taken };
  }

  // Whose resources to look through. Never an owner the caller couldn't create
  // or move a resource under, so this can't probe other people's IDs.
  let ownerUserId: string | null;
  let ownerGroupId: string | null;
  if (resourceId) {
    const existing = await requireResourceEditor(user, resourceId);
    if (existing.kind !== kind)
      throw createError({ statusCode: 400, statusMessage: "resourceId is not a resource of that kind" });
    if (owner === undefined) {
      ({ ownerUserId, ownerGroupId } = existing);
    } else {
      ({ ownerUserId, ownerGroupId } = await resolveResourceOwner(user, owner));
    }
  } else {
    ({ ownerUserId, ownerGroupId } = await resolveResourceOwner(user, owner ?? null));
  }

  // The owner's own readable-ID lookup is case-insensitive, like the unique indexes.
  const [taken] = await database
    .select({ id: resource.id })
    .from(resource)
    .where(
      and(
        eq(resource.kind, kind),
        ownerGroupId
          ? eq(resource.ownerGroupId, ownerGroupId)
          : eq(resource.ownerUserId, ownerUserId!),
        sql`lower(${resource.readableId}) = ${readableId}`,
        resourceId ? ne(resource.id, resourceId) : undefined,
      ),
    )
    .limit(1);
  return { available: !taken };
});
