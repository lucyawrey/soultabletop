import { getQuery } from "h3";
import { asc, eq } from "drizzle-orm";
import { content, resource } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireUuid } from "../../utils/resource-management";
import {
  getResourceAccessOrPublic,
  loadResourceAccessContext,
} from "../../utils/resource-access";

defineRouteMeta({
  openAPI: {
    tags: ["Content"],
    summary: "List accessible content records",
    description: "Without signing in, lists public content only.",
    parameters: [
      {
        name: "contentTypeId",
        in: "query",
        required: false,
        description: "Only content of this content type",
        schema: { type: "string", format: "uuid" },
      },
    ],
    responses: {
      200: { description: "Content list" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
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
  const accessContext = user
    ? await loadResourceAccessContext(
        user,
        records.map(({ resource: item }) => item.id),
      )
    : null;

  return records
    .map((record) => ({
      ...record,
      access: getResourceAccessOrPublic(record.resource, accessContext),
    }))
    .filter(({ access }) => access.canRead)
    .map(({ item, resource: resourceItem, access }) => ({
      id: resourceItem.id,
      readableId: resourceItem.readableId,
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
