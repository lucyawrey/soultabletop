import type { ResourceSource } from "#shared/resource-list";

// What `ResourceCards` needs from a list row.
export interface ResourceCardItem {
  id: string;
  name: string;
  readableId?: string;
  source?: ResourceSource;
  isPubliclyReadable?: boolean;
  updatedAt?: string;
}
