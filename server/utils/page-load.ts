// Whether a request is a browser loading a page (server-rendered HTML), not
// an API call, a build asset, Nuxt's own routes, a payload, or a prefetch.
// Used by `server/middleware/session-renewal.ts`; kept free of Nuxt so it can
// be tested.
export function isPageLoad(
  method: string,
  path: string,
  header: (name: string) => string | null | undefined,
) {
  if (method !== "GET") return false;
  const pathname = path.split("?", 1)[0]!;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_nuxt/") ||
    pathname.startsWith("/__") ||
    pathname.endsWith("/_payload.json")
  )
    return false;
  if (!header("accept")?.includes("text/html")) return false;
  // Speculative loads (link prefetch, Chrome's prerender) aren't the user
  // opening the page.
  const purpose = `${header("sec-purpose") ?? ""} ${header("purpose") ?? ""}`;
  if (/prefetch|prerender/i.test(purpose)) return false;
  return true;
}
