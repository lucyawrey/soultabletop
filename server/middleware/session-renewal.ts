import { defineEventHandler, getRequestHeader } from "h3";
import { renewSessionCookies } from "../utils/auth";

// Page loads (a browser asking for HTML, not `/api/...` or build assets) look
// the session up on the page request itself, so the cookies Better Auth renews
// reach the browser with the page (`renewSessionCookies`). API routes already
// pass them on when they look the session up.
export default defineEventHandler(async (event) => {
  if (event.method !== "GET") return;
  const path = event.path;
  if (path.startsWith("/api/") || path.startsWith("/_nuxt/") || path.startsWith("/__"))
    return;
  if (!getRequestHeader(event, "accept")?.includes("text/html")) return;
  await renewSessionCookies(event);
});
