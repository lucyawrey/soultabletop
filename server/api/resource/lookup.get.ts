import { createError, getQuery } from "h3";
import { eq } from "drizzle-orm";
import { campaign, content, contentType, sheet } from "../../database/schema";
import { getAuthenticatedUser, requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireResourceReader } from "../../utils/resource-management";
import {
  resolveResourceAddress,
  type ResourceKind,
} from "../../utils/resource-address";
import { parseResourceAddress } from "../../../shared/resource-address";

const KINDS: ResourceKind[] = ["system", "campaign", "contentType", "sheet", "content"];

defineRouteMeta({
  openAPI: {
    tags: ["Resource"],
    summary: "Look up a resource's ID and system",
    description:
      "A light version of the single-resource GET routes, with the same access check: the resource's `id`, `kind`, and `systemId` (a system's own ID; for others, the system they belong to). Address it with `id`, or with `owner` (a username or group readable ID) and `readableId`. Campaigns need an account, as `GET /api/campaign/{id}` does.",
    parameters: [
      {
        in: "query",
        name: "kind",
        required: true,
        schema: { type: "string", enum: KINDS },
      },
      { in: "query", name: "id", schema: { type: "string", format: "uuid" } },
      { in: "query", name: "owner", schema: { type: "string" } },
      { in: "query", name: "readableId", schema: { type: "string" } },
    ],
    responses: {
      200: { description: "The resource's ID, kind, and system ID" },
      400: { description: "Unknown kind" },
      401: { description: "Authentication required (campaigns)" },
      404: { description: "Not found" },
    },
  },
});

const asString = (value: unknown) => (typeof value === "string" ? value : undefined);

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const kind = KINDS.find((item) => item === query.kind);
  if (!kind)
    throw createError({
      statusCode: 400,
      statusMessage: `kind must be one of ${KINDS.join(", ")}`,
    });
  // The same authentication as the kind's GET route.
  const user =
    kind === "campaign"
      ? await requireAuthenticatedUser(event)
      : await getAuthenticatedUser(event);
  const readableId = asString(query.readableId);
  const address =
    readableId === undefined
      ? parseResourceAddress(asString(query.id), undefined)
      : parseResourceAddress(asString(query.owner), readableId);
  const id = await resolveResourceAddress(user, kind, address);
  // The same read check as the kind's GET route.
  const item = await requireResourceReader(user, id);
  if (item.kind !== kind)
    throw createError({ statusCode: 404, statusMessage: "Resource not found" });

  return { id: item.id, kind, systemId: await loadSystemId(kind, item.id) };
});

// A system's own ID; for the other kinds, the system they belong to.
async function loadSystemId(kind: ResourceKind, id: string): Promise<string | null> {
  if (kind === "system") return id;
  const database = useDatabase();
  const select = { systemId: contentType.systemId };
  const rows =
    kind === "campaign"
      ? await database
          .select({ systemId: campaign.systemId })
          .from(campaign)
          .where(eq(campaign.resourceId, id))
      : kind === "contentType"
        ? await database.select(select).from(contentType).where(eq(contentType.resourceId, id))
        : kind === "sheet"
          ? await database
              .select(select)
              .from(sheet)
              .innerJoin(contentType, eq(contentType.resourceId, sheet.contentTypeId))
              .where(eq(sheet.resourceId, id))
          : await database
              .select(select)
              .from(content)
              .innerJoin(contentType, eq(contentType.resourceId, content.contentTypeId))
              .where(eq(content.resourceId, id));
  return rows[0]?.systemId ?? null;
}
