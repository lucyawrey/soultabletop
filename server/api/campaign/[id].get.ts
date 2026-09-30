import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { campaign } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireResourceReader } from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign"],
    summary: "Get a campaign",
    responses: {
      200: { description: "Campaign" },
      404: { description: "Campaign not found" },
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
  if (item.kind !== "campaign")
    throw createError({ statusCode: 404, statusMessage: "Campaign not found" });
  const [campaignRow] = await useDatabase()
    .select({ systemId: campaign.systemId })
    .from(campaign)
    .where(eq(campaign.resourceId, id))
    .limit(1);
  return { ...item, systemId: campaignRow?.systemId };
});
