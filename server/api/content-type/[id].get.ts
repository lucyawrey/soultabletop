import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { contentType } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireResourceReader } from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "Get a ContentType",
    responses: {
      200: { description: "ContentType" },
      404: { description: "ContentType not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Resource ID is required",
    });
  const item = await requireResourceReader(user, id);
  if (item.kind !== "contentType")
    throw createError({
      statusCode: 404,
      statusMessage: "ContentType not found",
    });
  const [type] = await useDatabase()
    .select()
    .from(contentType)
    .where(eq(contentType.resourceId, id))
    .limit(1);
  if (!type)
    throw createError({
      statusCode: 404,
      statusMessage: "ContentType not found",
    });
  return { ...item, ...type };
});
