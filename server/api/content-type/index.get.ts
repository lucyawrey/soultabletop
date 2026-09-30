import { asc, eq } from "drizzle-orm";
import { contentType, resource } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccessOrPublic,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import { canChangeResourceOwner } from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "List accessible content types",
    responses: {
      200: { description: "Content type list" },
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
    .map((record) => ({
      ...record,
      access: getResourceAccessOrPublic(record.resource, context),
    }))
    .filter(({ access }) => access.canRead)
    .map(({ type, resource: item, access }) => ({
      id: item.id,
      readableId: item.readableId,
      isPubliclyReadable: item.isPubliclyReadable,
      name: item.name,
      systemId: type.systemId,
      contentCategory: type.contentCategory,
      hasStrictSchema: type.hasStrictSchema,
      schema: type.schema,
      ownerUserId: item.ownerUserId,
      ownerGroupId: item.ownerGroupId,
      canEdit: access.canEdit,
      canChangeOwner:
        !!user && !!context && canChangeResourceOwner(item, user, context),
    }));
});
