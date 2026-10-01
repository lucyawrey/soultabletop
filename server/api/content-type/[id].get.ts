import { createError } from "h3";
import { eq } from "drizzle-orm";
import { contentType } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireResourceReader } from "../../utils/resource-management";
import { resolveResourceRouteId } from "../../utils/resource-address";

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "Get a content type",
    responses: {
      200: { description: "Content type" },
      404: { description: "Content type not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const id = await resolveResourceRouteId(event, "contentType", user);
  const item = await requireResourceReader(user, id);
  if (item.kind !== "contentType")
    throw createError({
      statusCode: 404,
      statusMessage: "Content type not found",
    });
  const [type] = await useDatabase()
    .select()
    .from(contentType)
    .where(eq(contentType.resourceId, id))
    .limit(1);
  if (!type)
    throw createError({
      statusCode: 404,
      statusMessage: "Content type not found",
    });
  return { ...item, ...type };
});
