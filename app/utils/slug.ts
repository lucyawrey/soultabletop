export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getSlugError(slug: string) {
  if (!slug) return "";
  return slugPattern.test(slug)
    ? ""
    : "Use lowercase letters, numbers, and hyphens only.";
}
