import type { ContentCategory } from "#shared/content-categories";

// The icon beside a content type of each category (labels are in
// `shared/content-categories.ts`).
export const CONTENT_CATEGORY_ICONS: Record<ContentCategory, string> = {
  playerCharacter: "i-lucide-user",
  nonPlayerCharacter: "i-lucide-user",
  general: "i-lucide-scroll-text",
  page: "i-lucide-book-open",
};
