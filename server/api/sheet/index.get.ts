import { asc, eq } from "drizzle-orm";
import { resource, sheet } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccessOrPublic,
  loadResourceAccessContext,
} from "../../utils/resource-access";

defineRouteMeta({
  openAPI: {
    tags: ["Sheet"],
    summary: "List accessible sheets",
    responses: {
      200: { description: "Sheet list" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const database = useDatabase();
  const rows = await database
    .select({ sheet, resource })
    .from(sheet)
    .innerJoin(resource, eq(resource.id, sheet.resourceId))
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
    .map(({ sheet: item, resource: owner, access }) => ({
      ...owner,
      ...item,
      canEdit: access.canEdit,
    }));
});
