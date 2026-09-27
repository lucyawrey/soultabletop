import { createError, getRouterParam } from "h3";
import { getAuthenticatedUser } from "../../utils/auth";
import { requireResourceReader } from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["System"],
    summary: "Get a System",
    responses: {
      200: { description: "System" },
      404: { description: "System not found" },
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
  if (item.kind !== "system")
    throw createError({ statusCode: 404, statusMessage: "System not found" });
  return item;
});
