import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { content, contentType, resource } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { loadContentRefs } from "../../utils/content-refs";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccessOrPublic,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import {
  loadSheetSchemas,
  resolveContentSheet,
} from "../../utils/sheet-schemas";
import { canChangeResourceOwner } from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["Content"],
    summary: "Get a content record",
    description:
      "Includes the sheet to render it with (`sheet`), the schemas that sheet needs (`schemas`), the referenced content the viewer can read (`refs`), and the names and kinds of linked resources the viewer can read (`links`). Without signing in, only public content is returned, with only what is public in `sheet`, `refs`, and `links`.",
    responses: {
      200: { description: "Content record" },
      404: { description: "Not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing resource ID",
    });

  const database = useDatabase();
  const [record] = await database
    .select({
      item: content,
      resource,
      contentCategory: contentType.contentCategory,
      systemId: contentType.systemId,
    })
    .from(content)
    .innerJoin(resource, eq(resource.id, content.resourceId))
    .innerJoin(contentType, eq(contentType.resourceId, content.contentTypeId))
    .where(eq(content.resourceId, id))
    .limit(1);

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: "Content not found" });
  }

  const user = await getAuthenticatedUser(event);
  const context = user
    ? await loadResourceAccessContext(user, [record.resource.id])
    : null;
  const access = getResourceAccessOrPublic(record.resource, context);
  if (!access.canRead) {
    throw createError({ statusCode: 404, statusMessage: "Content not found" });
  }

  const schemas = await loadSheetSchemas(record.item.contentTypeId);
  if (!schemas) {
    throw createError({ statusCode: 404, statusMessage: "Content type not found" });
  }
  const [sheet, { refs, links }] = await Promise.all([
    resolveContentSheet(
      user,
      record.item.sheetId,
      record.item.contentTypeId,
      record.contentCategory,
      schemas,
    ),
    loadContentRefs(user, record.item.data, schemas),
  ]);

  return {
    id: record.resource.id,
    readableId: record.resource.readableId,
    isPubliclyReadable: record.resource.isPubliclyReadable,
    name: record.resource.name,
    ownerUserId: record.resource.ownerUserId,
    ownerGroupId: record.resource.ownerGroupId,
    canChangeOwner:
      !!user && !!context && canChangeResourceOwner(record.resource, user, context),
    createdAt: record.resource.createdAt,
    updatedAt: record.resource.updatedAt,
    ...record.item,
    contentCategory: record.contentCategory,
    systemId: record.systemId,
    canEdit: access.canEdit,
    sheet,
    schemas,
    refs,
    links,
  };
});
