// Display names are optional and not unique. Better Auth's `user.name` is
// required, so an empty display name is stored as the username (as typed at
// registration, else the lowercase stored username).

export const MAX_DISPLAY_NAME_LENGTH = 100;
// Usernames are capped so the default display name (the username as typed)
// always fits in a display name.
export const MAX_USERNAME_LENGTH = 40;

// Control characters and invisible or direction-changing characters that make
// names look like other names: zero-width space, left/right marks, bidi
// embedding/override/isolate controls, word joiner and invisible operators,
// BOM, soft hyphen, Arabic letter mark, Mongolian vowel separator. Zero-width
// joiner and non-joiner are allowed: emoji sequences and some scripts need them.
const DISALLOWED_NAME_CHARACTERS =
  /[\p{Cc}\u00AD\u061C\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/u;

// A message when a display name can't be stored; undefined when it is fine.
// Empty (after trimming) is fine here: it means "use the username".
export function getDisplayNameError(input: string) {
  const name = input.trim();
  if (name.length > MAX_DISPLAY_NAME_LENGTH)
    return `Display name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`;
  if (DISALLOWED_NAME_CHARACTERS.test(name))
    return "Display name can't contain control, invisible, or text-direction characters";
  return undefined;
}

// Like `getDisplayNameError`, but for a name that must be stored as is (not
// reset to the username), so empty is an error too.
export function getStoredNameError(input: string) {
  if (!input.trim()) return "Display name can't be empty";
  return getDisplayNameError(input);
}

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

// The name a default display name becomes when the username changes: the new
// username as typed (never longer than a display name), or undefined when the
// username isn't really changing (same apart from capitalization) or is empty.
export function nameForNewUsername(oldUsername: string, newUsernameTyped: string) {
  const typed = newUsernameTyped.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  if (!typed || typed.toLowerCase() === oldUsername.toLowerCase()) {
    return undefined;
  }
  return typed;
}

// The display name to store when the username changes: the new username as
// typed, if the current name is the untouched default (the old username in any
// capitalization, or empty). Undefined means leave the name alone.
export function syncedDisplayName(
  currentName: string,
  oldUsername: string,
  newUsernameTyped: string,
) {
  const typed = nameForNewUsername(oldUsername, newUsernameTyped);
  if (typed === undefined) return undefined;
  const name = currentName.trim();
  if (name && name.toLowerCase() !== oldUsername.toLowerCase()) return undefined;
  return typed;
}
