import type { Resource } from "../database/schema";
import type { ListScope } from "../../shared/resource-list";
import {
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
