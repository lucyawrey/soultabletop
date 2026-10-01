// Framework-free rules for user API keys, kept apart from `auth.ts` so they
// can be tested without Nuxt or a database.
import type { ApiKeyAccess } from "../../shared/api-keys";

export const API_KEY_PREFIX = "st_";

// The key from a request: `x-api-key`, or else `Authorization: Bearer`.
export function readApiKey(headers: Headers): string | null {
  const direct = headers.get("x-api-key")?.trim();
  if (direct) return direct;
  const match = headers.get("authorization")?.match(/^Bearer\s+(\S+)\s*$/i);
  return match?.[1] ?? null;
}

// How a key's access level is stored in the plugin's `permissions`.
export function apiKeyPermissions(access: ApiKeyAccess) {
  return { api: access === "full" ? ["read", "write"] : ["read"] };
}

// The access level stored on a key. Anything unexpected (no permissions,
// unparsable JSON) counts as read-only, so a mistake never grants writes.
export function apiKeyAccess(permissions: unknown): ApiKeyAccess {
  let value = permissions;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return "read";
    }
  }
  const api = (value as { api?: unknown } | null)?.api;
  return Array.isArray(api) && api.includes("write") ? "full" : "read";
}

// Methods a read-only key may use: the ones that don't change data.
export function isReadOnlyMethod(method: string) {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
