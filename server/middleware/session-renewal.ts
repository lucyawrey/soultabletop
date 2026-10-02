import { defineEventHandler, getRequestHeader } from "h3";
import { renewSessionCookies } from "../utils/auth";
import { isPageLoad } from "../utils/page-load";

// Page loads look the session up on the page request itself, so the cookies
// Better Auth renews reach the browser with the page (`renewSessionCookies`).
// API routes already pass them on when they look the session up.
export default defineEventHandler(async (event) => {
  if (!isPageLoad(event.method, event.path, (name) => getRequestHeader(event, name)))
    return;
  await renewSessionCookies(event);
});
