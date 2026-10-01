import { createError } from "h3";
import { eq } from "drizzle-orm";
import { resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireResourceEditor } from "../../utils/resource-management";
import { resolveResourceRouteId } from "../../utils/resource-address";

defineRouteMeta({
  openAPI: {
    tags: ["Sheet"],
    summary: "Delete a sheet",
    responses: {
      204: { description: "Deleted" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = await resolveResourceRouteId(event, "sheet", user);
  const item = await requireResourceEditor(user, id);
  if (item.kind !== "sheet")
    throw createError({ statusCode: 404, statusMessage: "Sheet not found" });
  await useDatabase().delete(resource).where(eq(resource.id, id));
  setResponseStatus(event, 204);
});
