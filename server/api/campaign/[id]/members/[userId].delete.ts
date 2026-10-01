import { createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { campaignMembership } from "../../../../database/schema";
import { requireAuthenticatedUser } from "../../../../utils/auth";
import {
  requireResourceEditor,
} from "../../../../utils/resource-management";
import { resolveResourceRouteId } from "../../../../utils/resource-address";
import { useDatabase } from "../../../../utils/database";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign Membership"],
    summary: "Remove a campaign member",
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
  await requireResourceEditor(user, campaignId);
  const userId = getRouterParam(event, "userId");
  if (!userId)
    throw createError({ statusCode: 400, statusMessage: "userId is required" });
  await useDatabase()
    .delete(campaignMembership)
    .where(
      and(eq(campaignMembership.campaignId, campaignId), eq(campaignMembership.userId, userId)),
    );
  setResponseStatus(event, 204);
});
