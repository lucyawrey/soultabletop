// Resource addresses, shared by API routes and pages. A resource is addressed
// by its ID (a UUID) or by its owner's readable ID (a username or group
// readable ID; they share one namespace) plus its own readable ID, which is
// unique per owner and kind: `/api/sheet/lucy/fighter`, `/sheets/lucy/fighter`.
// Both forms compare readable IDs lowercase.

export type ResourceAddress = { id: string } | { owner: string; readableId: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const READABLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Longer than any readable ID needs; anything longer is not looked up.
const MAX_ADDRESS_PART_LENGTH = 200;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function asReadableId(value: string | undefined) {
  if (!value || value.length > MAX_ADDRESS_PART_LENGTH) return undefined;
  const lower = value.toLowerCase();
  return READABLE_ID_PATTERN.test(lower) ? lower : undefined;
}

// The address in a route's parameters: `id` alone must be an ID; `id` with
// `readableId` is owner + readable ID (the owner sits in `id`, see
// `server/utils/resource-address.ts`). `null` when it can't address anything.
export function parseResourceAddress(
  id: string | undefined,
  readableId: string | undefined,
): ResourceAddress | null {
  if (readableId === undefined)
    return id && isUuid(id) ? { id: id.toLowerCase() } : null;
  const owner = asReadableId(id);
  const own = asReadableId(readableId);
  return owner && own ? { owner, readableId: own } : null;
}

// The path segment(s) of an address, for API and page URLs.
export function addressPath(address: ResourceAddress) {
  return "id" in address
    ? encodeURIComponent(address.id)
    : `${encodeURIComponent(address.owner)}/${encodeURIComponent(address.readableId)}`;
}

// Page sections with resource detail pages, and the kind each one shows.
// `/content` and `/characters` both show content.
export const RESOURCE_PAGE_SECTIONS = {
  systems: "system",
  campaigns: "campaign",
  types: "contentType",
  sheets: "sheet",
  content: "content",
  characters: "content",
} as const;

export type ResourcePageSection = keyof typeof RESOURCE_PAGE_SECTIONS;

// Readable IDs that can't be reached at `/<section>/<owner>/<readableId>`,
// because a static route takes that path for an owner named like an ID: the
// sheet editor page (`/sheets/<id>/edit`) and the campaign members API route
// (`/api/campaign/<id>/members`). Resources with these readable IDs keep
// their ID URLs.
const UNADDRESSABLE_READABLE_IDS: Partial<Record<ResourcePageSection, string[]>> = {
  sheets: ["edit"],
  campaigns: ["members"],
};

export function isResourcePageSection(value: string): value is ResourcePageSection {
  return Object.hasOwn(RESOURCE_PAGE_SECTIONS, value);
}

// The resource a page path shows: `/<section>/<id>[/...]` or
// `/<section>/<owner>/<readableId>[/...]`.
export function parseResourcePagePath(path: string) {
  const [section, first, second] = path.split("?")[0]!.split("/").filter(Boolean);
  if (!section || !first || !isResourcePageSection(section)) return null;
  const kind = RESOURCE_PAGE_SECTIONS[section];
  if (isUuid(first)) return { section, kind, address: { id: first.toLowerCase() } };
  if (!second || UNADDRESSABLE_READABLE_IDS[section]?.includes(second)) return null;
  const address = parseResourceAddress(first, second);
  return address ? { section, kind, address } : null;
}

// The owner + readable ID page path for a resource (`suffix` like "/edit"),
// or undefined when there isn't one that leads back to it: no owner readable
// ID, an owner readable ID shaped like an ID (read as one), or a readable ID
// that a static route takes (`UNADDRESSABLE_READABLE_IDS`).
export function readableResourcePagePath(
  section: ResourcePageSection,
  ownerReadableId: string | null | undefined,
  readableId: string | null | undefined,
  suffix = "",
) {
  const owner = asReadableId(ownerReadableId ?? undefined);
  const own = asReadableId(readableId ?? undefined);
  if (!owner || !own || isUuid(owner) || UNADDRESSABLE_READABLE_IDS[section]?.includes(own))
    return undefined;
  return `/${section}/${owner}/${own}${suffix}`;
}
