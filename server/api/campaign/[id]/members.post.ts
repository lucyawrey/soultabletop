import { createError } from "h3";
import { campaignMembership } from "../../../database/schema";
import { requireAuthenticatedUser } from "../../../utils/auth";
import {
  requireResourceEditor,
} from "../../../utils/resource-management";
import { resolveResourceRouteId } from "../../../utils/resource-address";
import { useDatabase } from "../../../utils/database";
import { parseBody, campaignMembershipSchema } from "../../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign Membership"],
    summary: "Add or update a campaign member",
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
  const campaignId = await resolveResourceRouteId(event, "campaign", user);
  await requireResourceEditor(user, campaignId);
  const body = await parseBody(event, campaignMembershipSchema);
  if (
    typeof body.userId !== "string" ||
    (body.role !== "gm" && body.role !== "player")
  )
    throw createError({
      statusCode: 400,
      statusMessage: "userId and role are required",
    });
  const [membership] = await useDatabase()
    .insert(campaignMembership)
    .values({ campaignId, userId: body.userId, role: body.role })
    .onConflictDoUpdate({
      target: [campaignMembership.campaignId, campaignMembership.userId],
      set: { role: body.role },
    })
    .returning();
  return membership;
});
