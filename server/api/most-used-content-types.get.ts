import { createError, getQuery } from "h3";
import { asc, count, desc, eq } from "drizzle-orm";
import { content, contentType, resource } from "../database/schema";
import { requireAuthenticatedUser } from "../utils/auth";
import { useDatabase } from "../utils/database";
import { getResourceAccess, loadResourceAccessContext } from "../utils/resource-access";
import { requireResourceReader, requireUuid } from "../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "Content types of a system, most used first",
    description:
      "The IDs of the system's content types the caller can read, ordered by how much content of each type exists on the site (anyone's), then by name. Create dialogs use it to preselect a type.",
    parameters: [
      {
        name: "systemId",
        in: "query",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    responses: {
      200: { description: "`{ ids }`, most used first" },
      404: { description: "System not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const systemId = requireUuid(getQuery(event).systemId, "systemId");
  const system = await requireResourceReader(user, systemId);
  if (system.kind !== "system")
    throw createError({ statusCode: 404, statusMessage: "System not found" });

  const rows = await useDatabase()
    .select({ resource, uses: count(content.resourceId) })
    .from(contentType)
    .innerJoin(resource, eq(resource.id, contentType.resourceId))
    .leftJoin(content, eq(content.contentTypeId, contentType.resourceId))
    .where(eq(contentType.systemId, systemId))
    .groupBy(resource.id)
    .orderBy(desc(count(content.resourceId)), asc(resource.name));

  // Only the types the caller can read: the counts themselves aren't returned.
  const context = await loadResourceAccessContext(
    user,
    rows.map((row) => row.resource.id),
  );
  return {
    ids: rows
      .filter((row) => getResourceAccess(row.resource, context).canRead)
      .map((row) => row.resource.id),
  };
});
