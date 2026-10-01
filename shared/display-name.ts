// Display names are optional and not unique. Better Auth's `user.name` is
// required, so an empty display name is stored as the username (as typed at
// registration, else the lowercase stored username).

export const MAX_DISPLAY_NAME_LENGTH = 100;

// The value to store for a submitted display name: the trimmed name, or the
// fallback (the username) when it is missing or blank.
export function resolveDisplayName(input: unknown, fallback: string) {
  const name = typeof input === "string" ? input.trim() : "";
  return name || fallback;
}

// How to show a user where people may need to tell users apart: the display
// name with the username as a handle. When the display name is just the
// username (any capitalization), the handle would repeat it, so it is dropped.
export function formatUserLabel(name: string, username?: string | null) {
  if (!username || name.toLowerCase() === username.toLowerCase()) return name;
  return `${name} (@${username})`;
}
