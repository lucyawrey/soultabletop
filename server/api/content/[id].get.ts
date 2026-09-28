import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { content, resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";

defineRouteMeta({
  openAPI: {
    tags: ["Content"],
    summary: "Get a Content record",
    responses: {
      200: { description: "Content record" },
      401: { description: "Authentication required" },
      404: { description: "Not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing Resource ID",
    });

  const database = useDatabase();
  const [record] = await database
    .select({ item: content, resource })
    .from(content)
    .innerJoin(resource, eq(resource.id, content.resourceId))
    .where(eq(content.resourceId, id))
    .limit(1);

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: "Content not found" });
  }

  const user = await requireAuthenticatedUser(event);
  const context = await loadResourceAccessContext(user, [record.resource.id]);
  const access = getResourceAccess(record.resource, context);
  if (!access.canRead) {
    throw createError({ statusCode: 404, statusMessage: "Content not found" });
  }

  return {
    id: record.resource.id,
    slug: record.resource.slug,
    isPubliclyReadable: record.resource.isPubliclyReadable,
    name: record.resource.name,
    createdAt: record.resource.createdAt,
    updatedAt: record.resource.updatedAt,
    ...record.item,
    canEdit: access.canEdit,
  };
});
