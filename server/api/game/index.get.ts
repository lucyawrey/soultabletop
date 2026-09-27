import { asc, eq } from "drizzle-orm";
import { game, resource } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";

defineRouteMeta({
  openAPI: {
    tags: ["Game"],
    summary: "List accessible Games",
    responses: {
      200: { description: "Game list" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const database = useDatabase();
  const rows = await database
    .select({ game, resource })
    .from(game)
    .innerJoin(resource, eq(resource.id, game.resourceId))
    .orderBy(asc(resource.name));
  const context = user
    ? await loadResourceAccessContext(
        user,
        rows.map(({ resource: item }) => item.id),
      )
    : null;
  return rows
    .filter(({ resource: item }) =>
      context
        ? getResourceAccess(item, context).canRead
        : item.isPubliclyReadable && !item.isAdminHidden,
    )
    .map(({ game: item, resource: owner }) => ({ ...owner, ...item }));
});
