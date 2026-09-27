import { createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { gameMembership } from "../../../../database/schema";
import { requireAuthenticatedUser } from "../../../../utils/auth";
import {
  requireResourceEditor,
  requireUuid,
} from "../../../../utils/resource-management";
import { useDatabase } from "../../../../utils/database";

defineRouteMeta({
  openAPI: {
    tags: ["Game Membership"],
    summary: "Remove a Game member",
    responses: {
      204: { description: "Removed" },
      401: { description: "Authentication required" },
      403: { description: "Not allowed" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const gameId = requireUuid(getRouterParam(event, "id"), "gameId");
  await requireResourceEditor(user, gameId);
  const userId = getRouterParam(event, "userId");
  if (!userId)
    throw createError({ statusCode: 400, statusMessage: "userId is required" });
  await useDatabase()
    .delete(gameMembership)
    .where(
      and(eq(gameMembership.gameId, gameId), eq(gameMembership.userId, userId)),
    );
  setResponseStatus(event, 204);
});
