export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Returns undefined (not "") when valid: UFormField's `error` prop is typed
// [Boolean, String], so Vue casts "" to `true` and the field renders as errored.
export function getSlugError(slug: string) {
  if (!slug || slugPattern.test(slug)) return undefined;
  return "Use lowercase letters, numbers, and hyphens only.";
}
