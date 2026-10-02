// Who owns a resource, as detail pages show it: "@username" for a user, the
// group's readable ID for a group. Empty while the owner isn't known.
export function ownerLabel(item: {
  ownerReadableId?: string | null;
  ownerGroupId: string | null;
}) {
  if (!item.ownerReadableId) return null;
  return item.ownerGroupId ? item.ownerReadableId : `@${item.ownerReadableId}`;
}

// A resource's full address as lists and detail headers show it,
// `owner/readable-id`, or just the readable ID while the owner isn't known.
export function resourceAddress(owner: string | null | undefined, readableId: string) {
  return owner ? `${owner}/${readableId}` : readableId;
}
