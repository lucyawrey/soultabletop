import { createError, getRouterParam } from "h3";
import { requireAuthenticatedUser } from "../../../../utils/auth";
import { removeMembership, requireCampaignMemberManager } from "../../../../utils/campaign-members";
import { resolveResourceRouteId } from "../../../../utils/resource-address";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign Membership"],
    summary: "Remove a campaign member",
    description:
      "Allowed for the campaign's editors. Its GMs may also remove players and themselves, but not another GM or an owner.",
    responses: {
      204: { description: "Removed" },
      401: { description: "Authentication required" },
      403: { description: "Not allowed" },
      409: { description: "The membership changed meanwhile" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const campaignId = await resolveResourceRouteId(event, "campaign", user);
  const userId = getRouterParam(event, "userId");
  if (!userId)
    throw createError({ statusCode: 400, statusMessage: "userId is required" });
  const expected = await requireCampaignMemberManager(user, campaignId, userId, undefined);
  await removeMembership(campaignId, userId, expected);
  setResponseStatus(event, 204);
});
