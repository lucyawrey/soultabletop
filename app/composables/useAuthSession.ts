import { authClient } from "~/utils/auth-client";

export function useAuthSession() {
  // Better Auth builds the URL itself, and on a Vercel server it picks the
  // deployment's own address (from `VERCEL_URL`), so the server render would
  // make a real request there without the visitor's cookie and see them as
  // logged out. A relative path is an internal call that forwards the cookie
  // during server rendering and uses the page's own origin in the browser.
  return authClient.useSession((_url: string, options: object) =>
    useFetch("/api/auth/get-session", options),
  );
}
