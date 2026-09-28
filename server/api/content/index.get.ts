import { getQuery } from "h3";
import { asc, eq } from "drizzle-orm";
import { content, resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireUuid } from "../../utils/resource-management";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";

defineRouteMeta({
  openAPI: {
    tags: ["Content"],
    summary: "List accessible Content records",
    parameters: [
      {
        name: "contentTypeId",
        in: "query",
        required: false,
        description: "Only Content of this ContentType",
        schema: { type: "string", format: "uuid" },
      },
    ],
    responses: {
      200: { description: "Content list" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const { contentTypeId } = getQuery(event);
  if (contentTypeId !== undefined) requireUuid(contentTypeId, "contentTypeId");
  const database = useDatabase();
  const records = await database
    .select({ item: content, resource })
    .from(content)
    .innerJoin(resource, eq(resource.id, content.resourceId))
    .where(
      typeof contentTypeId === "string"
        ? eq(content.contentTypeId, contentTypeId)
        : undefined,
    )
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
      isPubliclyReadable: resourceItem.isPubliclyReadable,
      name: resourceItem.name,
      createdAt: resourceItem.createdAt,
      updatedAt: resourceItem.updatedAt,
      contentTypeId: item.contentTypeId,
      sheetId: item.sheetId,
      data: item.data,
      canEdit: access.canEdit,
    }));
});
