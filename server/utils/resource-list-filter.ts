import type { Resource } from "../database/schema";
import type { ListQuery, ListScope, ResourceSource } from "../../shared/resource-list";
import {
  getGrantEffect,
  getResourceAccessOrPublic,
  type ResourceAccess,
  type ResourceAccessContext,
} from "./resource-access";

// Whether a row belongs in a list, given the user's access to it. Everything
// listed must be readable. "Mine" also needs a stake in it: owned by the user
// or their groups, edit access (for shared resources), or, for a campaign,
// membership. Public and unscoped lists need nothing more than read access.
export function isListed(
  item: Resource,
  access: ResourceAccess,
  context: ResourceAccessContext | null,
  scope: ListScope | undefined,
) {
  if (!access.canRead) return false;
  if (scope !== "mine" || !context) return true;
  return (
    item.ownerUserId === context.userId ||
    (!!item.ownerGroupId && context.groupRoles.has(item.ownerGroupId)) ||
    access.canEdit ||
    context.campaignRoles.has(item.id)
  );
}

// The IDs among `resources` that the viewer can read, for restricting a list
// to rows whose parent (a content's content type) is readable too.
export function readableResourceIds(
  resources: Resource[],
  context: ResourceAccessContext | null,
) {
  return resources
    .filter((item) => getResourceAccessOrPublic(item, context).canRead)
    .map((item) => item.id);
}

// `/api/content` restricts to readable content types only for the Characters
// and Content lists, which send `categories`; pickers and dropdowns don't.
export function requiresReadableType(categories: unknown) {
  return categories !== undefined;
}

// Where a resource comes from, relative to the viewer. Precedence: yours, your
// groups' (including a system group you belong to), Official, shared with you
// through a grant, then Community. Logged-out viewers only get Official and
// Community.
export function getResourceSource(
  item: Resource,
  official: boolean,
  context: ResourceAccessContext | null,
): ResourceSource {
  if (context) {
    if (item.ownerUserId === context.userId) return "you";
    if (item.ownerGroupId && context.groupRoles.has(item.ownerGroupId))
      return "yourGroups";
  }
  if (official) return "official";
  if (
    context?.grants.some(
      (grant) =>
        grant.resourceId === item.id && getGrantEffect(grant, context).applies,
    )
  )
    return "shared";
  return "community";
}

// Find (public scope) leaves out what the viewer's My tab lists, so the two
// don't repeat each other, unless they're searching: a search shows everything
// that matches, their own things included.
export function excludesMineFromFind(query: ListQuery, loggedIn: boolean) {
  return query.scope === "public" && loggedIn && !query.q;
}
