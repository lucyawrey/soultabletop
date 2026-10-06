import { createError } from "h3";
import { getAuthenticatedUser } from "../../../utils/auth";
import { requireResourceReader } from "../../../utils/resource-management";
import { resolveResourceRouteId } from "../../../utils/resource-address";
import { loadSheetSchemas, resolvePreviewSheet } from "../../../utils/sheet-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "Get the Sheet that previews a content type's content",
    description:
      "The content type's default Sheet and the schemas to compile it with, when the viewer can read it and it has a <Preview> beside <Sheet>; otherwise `sheet` is null and previews use the generated view.",
    responses: {
      200: { description: "Preview sheet, or null" },
      404: { description: "Content type not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const id = await resolveResourceRouteId(event, "contentType", user);
  const item = await requireResourceReader(user, id);
  if (item.kind !== "contentType")
    throw createError({
      statusCode: 404,
      statusMessage: "Content type not found",
    });
  const sheet = await resolvePreviewSheet(user, id);
  if (!sheet) return { sheet: null, schemas: null };
  const schemas = await loadSheetSchemas(id);
  if (!schemas) return { sheet: null, schemas: null };
  return { sheet, schemas };
});
