import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { resourceGrant } from "../../../database/schema";
import { requireAuthenticatedUser } from "../../../utils/auth";
import {
  requireResourceEditor,
  requireUuid,
} from "../../../utils/resource-management";
import { useDatabase } from "../../../utils/database";

defineRouteMeta({
  openAPI: {
    tags: ["Resource Grants"],
    summary: "List resource grants",
    responses: {
      200: { description: "Grant list" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const resourceId = requireUuid(getRouterParam(event, "id"), "resourceId");
  await requireResourceEditor(user, resourceId);
  return useDatabase()
    .select()
    .from(resourceGrant)
    .where(eq(resourceGrant.resourceId, resourceId));
});
