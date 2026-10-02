// Rules for Better Auth's session cookie cache (`session.cookieCache` in
// `auth.ts`), kept apart from `auth.ts` so they can be tested without Nuxt.

// How long a cached session is trusted, in seconds: a revoked session or a
// changed name can take this long to show where the cookie was cached.
export const SESSION_CACHE_MAX_AGE = 5 * 60;

// The `Set-Cookie` values for the cache cookie `cacheCookieName` (Better
// Auth splits a long one into `<name>.0`, `<name>.1`, ...). Everything else,
// the session token cookie in particular, is left out.
export function sessionCacheSetCookies(setCookies: string[], cacheCookieName: string) {
  return setCookies.filter((cookie) => {
    const name = cookie.slice(0, cookie.indexOf("=")).trim();
    return (
      name === cacheCookieName ||
      new RegExp(`^${escapeRegExp(cacheCookieName)}\\.\\d+$`).test(name)
    );
  });
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
