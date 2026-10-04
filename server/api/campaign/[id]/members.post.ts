import { createError } from "h3";
import { requireAuthenticatedUser } from "../../../utils/auth";
import { requireCampaignMemberManager, writeMembership } from "../../../utils/campaign-members";
import { resolveResourceRouteId } from "../../../utils/resource-address";
import { parseBody, campaignMembershipSchema } from "../../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign Membership"],
    summary: "Add or update a campaign member",
    description:
      "Allowed for the campaign's editors. Its GMs may also add and remove players and change or remove their own membership, but not make anyone a GM, change another GM, or change an owner's membership. A new member gets every grant shared with the campaign's members (`campaignAudience: \"members\"`, including edit grants), so a GM adding a player passes those on. 409 when a GM's change meets a membership that changed since it was checked.",
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
      409: { description: "The membership changed meanwhile" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const campaignId = await resolveResourceRouteId(event, "campaign", user);
  const body = await parseBody(event, campaignMembershipSchema);
  if (
    typeof body.userId !== "string" ||
    (body.role !== "gm" && body.role !== "player")
  )
    throw createError({
      statusCode: 400,
      statusMessage: "userId and role are required",
    });
  const expected = await requireCampaignMemberManager(user, campaignId, body.userId, body.role);
  const membership = await writeMembership(campaignId, body.userId, body.role, expected);
  return membership;
});
