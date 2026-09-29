import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { game } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireResourceReader } from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["Game"],
    summary: "Get a game",
    responses: {
      200: { description: "Game" },
      404: { description: "Game not found" },
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
  if (item.kind !== "game")
    throw createError({ statusCode: 404, statusMessage: "Game not found" });
  const [gameRow] = await useDatabase()
    .select({ systemId: game.systemId })
    .from(game)
    .where(eq(game.resourceId, id))
    .limit(1);
  return { ...item, systemId: gameRow?.systemId };
});
