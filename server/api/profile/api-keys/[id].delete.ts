import { and, eq } from "drizzle-orm";
import { createError, getRouterParam } from "h3";
import { apikey } from "../../../database/schema";
import { requireSessionUser } from "../../../utils/auth";
import { useDatabase } from "../../../utils/database";

defineRouteMeta({
  openAPI: {
    tags: ["Profile"],
    summary: "Delete one of your API keys",
    description:
      "The key stops working at once. Needs a signed-in session; API keys can't call it.",
    responses: {
      204: { description: "Deleted" },
      401: { description: "Authentication required" },
      403: { description: "Called with an API key" },
      404: { description: "No such key of yours" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event);
  const id = getRouterParam(event, "id");
  const deleted = id
    ? await useDatabase()
        .delete(apikey)
        .where(and(eq(apikey.id, id), eq(apikey.referenceId, user.id)))
        .returning({ id: apikey.id })
    : [];
  if (deleted.length === 0)
    throw createError({ statusCode: 404, statusMessage: "API key not found" });
  setResponseStatus(event, 204);
  return null;
});
