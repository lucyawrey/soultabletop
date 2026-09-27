import { asc } from "drizzle-orm";
import { group } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";

defineRouteMeta({
  openAPI: {
    tags: ["Group"],
    summary: "List Groups",
    responses: {
      200: { description: "Group list" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  await requireAuthenticatedUser(event);
  return useDatabase().select().from(group).orderBy(asc(group.name));
});
