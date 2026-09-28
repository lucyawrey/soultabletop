import { asc, eq } from "drizzle-orm";
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
    summary: "List accessible Content records",
    responses: {
      200: { description: "Content list" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const database = useDatabase();
  const records = await database
    .select({ item: content, resource })
    .from(content)
    .innerJoin(resource, eq(resource.id, content.resourceId))
    .orderBy(asc(resource.createdAt));
  const accessContext = await loadResourceAccessContext(
    user,
    records.map(({ resource: item }) => item.id),
  );

  return records
    .map((record) => ({
      ...record,
      access: getResourceAccess(record.resource, accessContext),
    }))
    .filter(({ access }) => access.canRead)
    .map(({ item, resource: resourceItem, access }) => ({
      id: resourceItem.id,
      slug: resourceItem.slug,
      name: resourceItem.name,
      createdAt: resourceItem.createdAt,
      updatedAt: resourceItem.updatedAt,
      contentTypeId: item.contentTypeId,
      sheetId: item.sheetId,
      data: item.data,
      canEdit: access.canEdit,
    }));
});
