// Content categories, in the order of the `content_category` Postgres enum.
// Characters pages show the character categories; Content pages the rest.
export const CONTENT_CATEGORIES = [
  "general",
  "nonPlayerCharacter",
  "page",
  "playerCharacter",
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export const CHARACTER_CATEGORIES = [
  "playerCharacter",
  "nonPlayerCharacter",
] as const satisfies readonly ContentCategory[];

export const NON_CHARACTER_CATEGORIES = [
  "general",
  "page",
] as const satisfies readonly ContentCategory[];

export function isCharacterCategory(category: ContentCategory) {
  return (CHARACTER_CATEGORIES as readonly ContentCategory[]).includes(
    category,
  );
}

export const CONTENT_CATEGORY_LABELS: Record<ContentCategory, string> = {
  general: "General",
  nonPlayerCharacter: "Non-Player Character",
  page: "Page",
  playerCharacter: "Player Character",
};
