// User API key options shared by the profile page and the key endpoints.

// What a key may do: `read` keys are refused on any request that changes
// data (see `server/utils/api-key-rules.ts`); `full` keys act as the user.
export const API_KEY_ACCESS = ["read", "full"] as const;
export type ApiKeyAccess = (typeof API_KEY_ACCESS)[number];

export const API_KEY_ACCESS_LABELS: Record<ApiKeyAccess, string> = {
  read: "Read Only",
  full: "Full Access",
};

// Expiry choices in days; `null` means the key never expires. The plugin
// allows 1 to 365 days.
export const API_KEY_EXPIRY_DAYS = [7, 30, 90, 365] as const;

export const MAX_API_KEY_NAME_LENGTH = 100;

// How many keys one user may have at a time.
export const MAX_API_KEYS_PER_USER = 25;
