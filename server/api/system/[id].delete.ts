import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireResourceEditor } from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["System"],
    summary: "Delete a System",
    responses: {
      204: { description: "Deleted" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Resource ID is required",
    });
  const item = await requireResourceEditor(user, id);
  if (item.kind !== "system")
    throw createError({ statusCode: 404, statusMessage: "System not found" });
  await useDatabase().delete(resource).where(eq(resource.id, id));
  setResponseStatus(event, 204);
});
