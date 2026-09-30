// The page to return to after signing in, from the sign-in page's `redirect`
// query value. Only paths on this site are accepted, so a crafted link can't
// send someone to another site after they sign in.
export function safeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2000) return undefined;
  // One leading slash: "//host" and "/\host" are read as other sites.
  if (!/^\/[^/\\]/.test(value)) return undefined;
  // Control characters and backslashes never belong in a path.
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || char === "\\") return undefined;
  }
  return value;
}
