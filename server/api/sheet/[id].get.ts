import { createError } from "h3";
import { eq } from "drizzle-orm";
import { contentType, sheet } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireResourceReader } from "../../utils/resource-management";
import { processSheetCss } from "../../../shared/sheet/css";
import { loadSheetSchemas } from "../../utils/sheet-schemas";
import { resolveResourceRouteId } from "../../utils/resource-address";

defineRouteMeta({
  openAPI: {
    tags: ["Sheet"],
    summary: "Get a sheet",
    description:
      "Includes the schemas its markup is checked against (`schemas`), its content type's `contentCategory` and `systemId`, and its CSS scoped for rendering (`css`).",
    responses: {
      200: { description: "Sheet" },
      404: { description: "Sheet not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const id = await resolveResourceRouteId(event, "sheet", user);
  const item = await requireResourceReader(user, id);
  if (item.kind !== "sheet")
    throw createError({ statusCode: 404, statusMessage: "Sheet not found" });
  const [row] = await useDatabase()
    .select({
      sheet,
      contentCategory: contentType.contentCategory,
      systemId: contentType.systemId,
    })
    .from(sheet)
    .innerJoin(contentType, eq(contentType.resourceId, sheet.contentTypeId))
    .where(eq(sheet.resourceId, id))
    .limit(1);
  if (!row)
    throw createError({ statusCode: 404, statusMessage: "Sheet not found" });
  const schemas = await loadSheetSchemas(row.sheet.contentTypeId);
  return {
    ...item,
    ...row.sheet,
    contentCategory: row.contentCategory,
    systemId: row.systemId,
    css: processSheetCss(row.sheet.cssStyles, id).css,
    schemas,
  };
});
