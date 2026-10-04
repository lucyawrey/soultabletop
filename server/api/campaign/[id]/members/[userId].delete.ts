import { createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { campaignMembership } from "../../../../database/schema";
import { requireAuthenticatedUser } from "../../../../utils/auth";
import { requireCampaignMemberManager } from "../../../../utils/campaign-members";
import { resolveResourceRouteId } from "../../../../utils/resource-address";
import { useDatabase } from "../../../../utils/database";

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
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const campaignId = await resolveResourceRouteId(event, "campaign", user);
  const userId = getRouterParam(event, "userId");
  if (!userId)
    throw createError({ statusCode: 400, statusMessage: "userId is required" });
  await requireCampaignMemberManager(user, campaignId, userId, undefined);
  await useDatabase()
    .delete(campaignMembership)
    .where(
      and(eq(campaignMembership.campaignId, campaignId), eq(campaignMembership.userId, userId)),
    );
  setResponseStatus(event, 204);
});
