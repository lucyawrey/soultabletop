import { asc, eq } from "drizzle-orm";
import { contentType, resource } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "List accessible ContentTypes",
    responses: {
      200: { description: "ContentType list" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const database = useDatabase();
  const records = await database
    .select({ type: contentType, resource })
    .from(contentType)
    .innerJoin(resource, eq(resource.id, contentType.resourceId))
    .orderBy(asc(resource.name));
  const context = user
    ? await loadResourceAccessContext(
        user,
        records.map(({ resource: item }) => item.id),
      )
    : null;

  return records
    .filter(({ resource: item }) =>
      context
        ? getResourceAccess(item, context).canRead
        : item.isPubliclyReadable && !item.isAdminHidden,
    )
    .map(({ type, resource: item }) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      systemId: type.systemId,
      contentCategory: type.contentCategory,
      hasStrictSchema: type.hasStrictSchema,
      schema: type.schema,
    }));
});
