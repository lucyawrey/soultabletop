import { createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { resourceGrant } from "../../../../database/schema";
import { requireAuthenticatedUser } from "../../../../utils/auth";
import {
  requireResourceEditor,
  requireUuid,
} from "../../../../utils/resource-management";
import { useDatabase } from "../../../../utils/database";

defineRouteMeta({
  openAPI: {
    tags: ["Resource Grants"],
    summary: "Delete a resource grant",
    responses: {
      204: { description: "Deleted" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const resourceId = requireUuid(getRouterParam(event, "id"), "resourceId");
  const grantId = requireUuid(getRouterParam(event, "grantId"), "grantId");
  await requireResourceEditor(user, resourceId);
  const deleted = await useDatabase()
    .delete(resourceGrant)
    .where(
      and(
        eq(resourceGrant.id, grantId),
        eq(resourceGrant.resourceId, resourceId),
      ),
    )
    .returning({ id: resourceGrant.id });
  if (!deleted.length)
    throw createError({ statusCode: 404, statusMessage: "Grant not found" });
  setResponseStatus(event, 204);
});
