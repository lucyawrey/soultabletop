import type { ResourceSource } from "#shared/resource-list";

// What `ResourceCards` needs from a list row.
export interface ResourceCardItem {
  id: string;
  name: string;
  readableId?: string;
  // Shown before the readable ID as `owner/id` (not for groups, which are owners).
  ownerReadableId?: string | null;
  source?: ResourceSource;
  isPubliclyReadable?: boolean;
  updatedAt?: string;
}
