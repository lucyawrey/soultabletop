import { asc, eq } from "drizzle-orm";
import { resource, system } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccessOrPublic,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import { canChangeResourceOwner } from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["System"],
    summary: "List accessible systems",
    responses: {
      200: { description: "System list" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const database = useDatabase();
  const rows = await database
    .select({ resource })
    .from(system)
    .innerJoin(resource, eq(resource.id, system.resourceId))
    .orderBy(asc(resource.name));
  const context = user
    ? await loadResourceAccessContext(
        user,
        rows.map(({ resource: item }) => item.id),
      )
    : null;
  return rows
    .map(({ resource: item }) => ({
      item,
      access: getResourceAccessOrPublic(item, context),
    }))
    .filter(({ access }) => access.canRead)
    .map(({ item, access }) => ({
      ...item,
      canEdit: access.canEdit,
      canChangeOwner:
        !!user && !!context && canChangeResourceOwner(item, user, context),
    }));
});
