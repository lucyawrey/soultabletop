import { createError, getRouterParam } from "h3";
import { gameMembership } from "../../../database/schema";
import { requireAuthenticatedUser } from "../../../utils/auth";
import {
  requireResourceEditor,
  requireUuid,
} from "../../../utils/resource-management";
import { useDatabase } from "../../../utils/database";
import { parseBody, gameMembershipSchema } from "../../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["Game Membership"],
    summary: "Add or update a Game member",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["userId", "role"],
            properties: {
              userId: { type: "string" },
              role: { type: "string", enum: ["gm", "player"] },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated membership" },
      401: { description: "Authentication required" },
      403: { description: "Not allowed" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const gameId = requireUuid(getRouterParam(event, "id"), "gameId");
  await requireResourceEditor(user, gameId);
  const body = await parseBody(event, gameMembershipSchema);
  if (
    typeof body.userId !== "string" ||
    (body.role !== "gm" && body.role !== "player")
  )
    throw createError({
      statusCode: 400,
      statusMessage: "userId and role are required",
    });
  const [membership] = await useDatabase()
    .insert(gameMembership)
    .values({ gameId, userId: body.userId, role: body.role })
    .onConflictDoUpdate({
      target: [gameMembership.gameId, gameMembership.userId],
      set: { role: body.role },
    })
    .returning();
  return membership;
});
