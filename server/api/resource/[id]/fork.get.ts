import { getRouterParam } from "h3";
import { requireAuthenticatedUser } from "../../../utils/auth";
import { requireUuid } from "../../../utils/resource-management";
import { loadForkOptions } from "../../../utils/resource-fork";

defineRouteMeta({
  openAPI: {
    tags: ["Resource"],
    summary: "What forking a resource can copy",
    description:
      "The resource, its parents by the same owner (sheet → content type → system), and the same owner's resources below the topmost parent that can be copied with it.",
    responses: {
      200: { description: "Fork options" },
      400: { description: "Not a system, content type, or sheet" },
      401: { description: "Authentication required" },
      404: { description: "Resource not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const resourceId = requireUuid(getRouterParam(event, "id"), "resourceId");
  return loadForkOptions(user, resourceId);
});
