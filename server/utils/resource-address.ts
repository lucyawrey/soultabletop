import { and, eq, exists, or, sql, type SQL } from "drizzle-orm";
import type { User } from "better-auth";
import { createError, getRouterParam, type H3Event } from "h3";
import {
  group,
  ownerReadableId,
  resource,
  userProfile,
  type Resource,
} from "../database/schema";
import {
  parseResourceAddress,
  type ResourceAddress,
} from "../../shared/resource-address";
import { useDatabase } from "./database";
import { publiclyListed, readableBy, type ResourceTable } from "./resource-access-sql";

// Resources are addressed two ways in routes: by ID (`/api/sheet/<id>`) or by
// owner + readable ID (`/api/sheet/<owner>/<readableId>`, where the owner is a
// username or a group readable ID; they share one namespace). The
// owner + readable ID routes are the same handlers as the ID routes (their
// files re-export them), with the owner in the `id` route parameter, so every
// handler starts with `resolveResourceRouteId` and continues with the ID.
//
// Resolving never tells a resource that exists apart from one that doesn't:
// an owner that doesn't exist, a resource that doesn't exist, and one the
// viewer can't read all give the same 404, from the same single query (the
// read rule is part of it). The handler then applies its usual checks to the
// ID, exactly as for the ID route.

export type ResourceKind = Resource["kind"];

function notFound() {
  return createError({ statusCode: 404, statusMessage: "Resource not found" });
}

// `getResourceAccessOrPublic(...).canRead` as SQL, for the viewer or (null) an
// anonymous visitor. Site admins read everything; checked inside the query so
// the query is the same whether or not the resource exists.
function viewerCanRead(table: ResourceTable, viewer: Pick<User, "id"> | null): SQL {
  if (!viewer) return publiclyListed(table);
  const isSiteAdmin = exists(
    useDatabase()
      .select({ one: sql`1` })
      .from(userProfile)
      .where(and(eq(userProfile.userId, viewer.id), eq(userProfile.role, "admin"))),
  );
  return or(isSiteAdmin, readableBy(table, { userId: viewer.id, isSiteAdmin: false }))!;
}

// The ID of the `kind` resource that `owner` (a username or group readable ID)
// has under `readableId`, if the viewer can read it. Both are compared
// lowercase (the unique indexes are on `lower(...)`).
export async function findReadableResourceId(
  viewer: Pick<User, "id"> | null,
  kind: ResourceKind,
  owner: string,
  readableId: string,
): Promise<string | undefined> {
  const [row] = await useDatabase()
    .select({ id: resource.id })
    .from(resource)
    .leftJoin(userProfile, eq(userProfile.userId, resource.ownerUserId))
    .leftJoin(group, eq(group.id, resource.ownerGroupId))
    .where(
      and(
        eq(resource.kind, kind),
        sql`lower(${resource.readableId}) = ${readableId.toLowerCase()}`,
        or(
          sql`lower(${userProfile.username}) = ${owner.toLowerCase()}`,
          sql`lower(${group.readableId}) = ${owner.toLowerCase()}`,
        ),
        viewerCanRead(resource, viewer),
      ),
    )
    .limit(1);
  return row?.id;
}

// The resource ID an address points at: the ID itself, or the readable
// resource found for owner + readable ID. Throws the same 404 for an invalid
// address and for one that finds nothing the viewer can read. An ID is not
// checked here; the caller checks access to it as it always has.
export async function resolveResourceAddress(
  viewer: Pick<User, "id"> | null,
  kind: ResourceKind,
  address: ResourceAddress | null,
): Promise<string> {
  if (!address) throw notFound();
  if ("id" in address) return address.id;
  const id = await findReadableResourceId(viewer, kind, address.owner, address.readableId);
  if (!id) throw notFound();
  return id;
}

// For `[id]` route handlers: the resource ID from `/<id>` or
// `/<owner>/<readableId>` (see the top of this file). Call it after finding
// the user (`getAuthenticatedUser` or `requireAuthenticatedUser`), so
// unauthenticated requests fail the same way for both forms.
export function resolveResourceRouteId(
  event: H3Event,
  kind: ResourceKind,
  viewer: Pick<User, "id"> | null,
) {
  return resolveResourceAddress(
    viewer,
    kind,
    parseResourceAddress(getRouterParam(event, "id"), getRouterParam(event, "readableId")),
  );
}

// The owner's readable ID (username or group readable ID), for building the
// resource's owner + readable ID address.
export async function loadOwnerReadableId(item: {
  ownerUserId: string | null;
  ownerGroupId: string | null;
}): Promise<string | null> {
  const owner = item.ownerUserId
    ? eq(ownerReadableId.userId, item.ownerUserId)
    : item.ownerGroupId
      ? eq(ownerReadableId.groupId, item.ownerGroupId)
      : undefined;
  if (!owner) return null;
  const [row] = await useDatabase()
    .select({ readableId: ownerReadableId.readableId })
    .from(ownerReadableId)
    .where(owner)
    .limit(1);
  return row?.readableId ?? null;
}
