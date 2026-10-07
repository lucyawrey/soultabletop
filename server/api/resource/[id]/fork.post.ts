import { getRouterParam } from "h3";
import { requireAuthenticatedUser } from "../../../utils/auth";
import { requireUuid } from "../../../utils/resource-management";
import { parseBody, resourceForkSchema } from "../../../utils/api-schemas";
import { forkResource } from "../../../utils/resource-fork";

defineRouteMeta({
  openAPI: {
    tags: ["Resource"],
    summary: "Fork a resource",
    description:
      "Copy a system, content type, or sheet into your own account (or a group's). Copies start Limited and record their source as forkedFromId; references among copies point at the copies.",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              ownerGroupId: { type: "string", format: "uuid", nullable: true },
              withParents: {
                type: "boolean",
                description: "Also copy the parents listed by GET .../fork",
              },
              include: {
                type: "array",
                items: { type: "string", format: "uuid" },
                description:
                  "Extras from GET .../fork to copy; each needs its parent copied too",
              },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "The copies, parents first; the copy of the resource itself has its ID as forkedFromId" },
      400: { description: "Invalid request" },
      401: { description: "Authentication required" },
      403: { description: "Can't create resources for that group" },
      404: { description: "Resource not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const resourceId = requireUuid(getRouterParam(event, "id"), "resourceId");
  const body = await parseBody(event, resourceForkSchema);
  const copies = await forkResource(user, resourceId, body ?? {});
  setResponseStatus(event, 201);
  return { copies };
});
