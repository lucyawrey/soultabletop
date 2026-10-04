import { createError } from "h3";
import { eq } from "drizzle-orm";
import { campaign } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { loadReadableResource } from "../../utils/resource-management";
import { canDeleteCampaign } from "../../utils/resource-access";
import { resolveResourceRouteId } from "../../utils/resource-address";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign"],
    summary: "Get a campaign",
    responses: {
      200: { description: "Campaign, with `canEdit` and `canDelete` (GMs can edit a campaign but not delete it)" },
      401: { description: "Authentication required" },
      404: { description: "Campaign not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = await resolveResourceRouteId(event, "campaign", user);
  const { item, context } = await loadReadableResource(user, id);
  if (item.kind !== "campaign")
    throw createError({ statusCode: 404, statusMessage: "Campaign not found" });
  const [campaignRow] = await useDatabase()
    .select({ systemId: campaign.systemId })
    .from(campaign)
    .where(eq(campaign.resourceId, id))
    .limit(1);
  // GMs can edit a campaign without being able to delete it.
  const canDelete = !!context && canDeleteCampaign(item, context);
  return { ...item, systemId: campaignRow?.systemId, canDelete };
});
