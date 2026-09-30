import { asc, eq } from "drizzle-orm";
import { campaign, resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccessOrPublic,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import { canChangeResourceOwner } from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign"],
    summary: "List accessible campaigns",
    responses: {
      200: { description: "Campaign list" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const database = useDatabase();
  const rows = await database
    .select({ campaign, resource })
    .from(campaign)
    .innerJoin(resource, eq(resource.id, campaign.resourceId))
    .orderBy(asc(resource.name));
  const context = user
    ? await loadResourceAccessContext(
        user,
        rows.map(({ resource: item }) => item.id),
      )
    : null;
  return rows
    .map((row) => ({
      ...row,
      access: getResourceAccessOrPublic(row.resource, context),
    }))
    .filter(({ access }) => access.canRead)
    .map(({ campaign: item, resource: owner, access }) => ({
      ...owner,
      ...item,
      canEdit: access.canEdit,
      canChangeOwner:
        !!user && !!context && canChangeResourceOwner(owner, user, context),
    }));
});
