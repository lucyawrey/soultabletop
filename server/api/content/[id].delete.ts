import { createError } from "h3";
import { eq } from "drizzle-orm";
import { resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import { resolveResourceRouteId } from "../../utils/resource-address";

defineRouteMeta({
  openAPI: {
    tags: ["Content"],
    summary: "Delete a content record",
    responses: {
      204: { description: "Deleted" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = await resolveResourceRouteId(event, "content", user);
  const database = useDatabase();
  const [resourceItem] = await database
    .select()
    .from(resource)
    .where(eq(resource.id, id))
    .limit(1);

  if (!resourceItem || resourceItem.kind !== "content") {
    throw createError({ statusCode: 404, statusMessage: "Content not found" });
  }

  const context = await loadResourceAccessContext(user, [resourceItem.id]);
  if (!getResourceAccess(resourceItem, context).canDelete) {
    throw createError({
      statusCode: 403,
      statusMessage: "Content cannot be deleted",
    });
  }

  await database.delete(resource).where(eq(resource.id, id));
  setResponseStatus(event, 204);
});
