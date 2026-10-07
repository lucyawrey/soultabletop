import type { ResourceLinkKind } from "./content-schema";

// What a forked resource was copied from, as single-resource GETs return it
// (`loadForkedFrom` in server/utils/resource-management.ts): the source's
// name and address when the viewer can read it, else only that it's not
// available (also when it was deleted). Null for a resource that isn't a fork.
export type ForkedFrom =
  | {
      id: string;
      available: true;
      kind: ResourceLinkKind;
      name: string;
      readableId: string;
      ownerReadableId: string | null;
    }
  | { id: string; available: false }
  | null;
