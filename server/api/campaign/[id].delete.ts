import { createError } from "h3";
import { eq } from "drizzle-orm";
import { resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { canDeleteCampaign, loadResourceAccessContext } from "../../utils/resource-access";
import { resolveResourceRouteId } from "../../utils/resource-address";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign"],
    summary: "Delete a campaign",
    description:
      "Allowed for the campaign's editors (its owner, the owning group's admins and editors, and users with an edit grant), but not for its GMs through their role alone.",
    responses: {
      204: { description: "Deleted" },
      401: { description: "Authentication required" },
      403: { description: "Not allowed to delete" },
      404: { description: "Campaign not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = await resolveResourceRouteId(event, "campaign", user);
  const database = useDatabase();
  const [item] = await database.select().from(resource).where(eq(resource.id, id)).limit(1);
  if (!item || item.kind !== "campaign")
    throw createError({ statusCode: 404, statusMessage: "Campaign not found" });
  const context = await loadResourceAccessContext(user, [id]);
  if (!canDeleteCampaign(item, context))
    throw createError({ statusCode: 403, statusMessage: "Not allowed to delete this campaign" });
  await database.delete(resource).where(eq(resource.id, id));
  setResponseStatus(event, 204);
});
