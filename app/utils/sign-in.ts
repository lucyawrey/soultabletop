// The sign-in page, returning to `path` afterwards (see `safeRedirectPath`).
export function signInRoute(path: string) {
  return { path: "/", query: { redirect: path } };
}
