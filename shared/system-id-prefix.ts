// The prefix generated IDs get for resources in a system: the system's own ID
// when it's short, else its initials, with parts that hold a digit kept whole
// (`pathfinder-2e` → `p2e`, `dungeons-and-dragons-5e` → `dad5e`).
export const MAX_SYSTEM_PREFIX_LENGTH = 8;

export function systemIdPrefix(systemReadableId: string) {
  if (systemReadableId.length <= MAX_SYSTEM_PREFIX_LENGTH) return systemReadableId;
  return systemReadableId
    .split("-")
    .filter(Boolean)
    .map((part) => (/\d/.test(part) ? part : part[0]))
    .join("");
}
