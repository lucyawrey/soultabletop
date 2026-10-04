import { METHOD_GUARDED_ROUTES, methodNotAllowed } from "../utils/method-not-allowed";

// Unsupported methods on nested routes answer 405 instead of falling back to
// another route's handler (see `server/utils/method-not-allowed.ts`).
// Registered without a method, as each route's catch-all; its own method
// handlers still take precedence.
export default defineNitroPlugin((nitroApp) => {
  for (const [path, allowed] of Object.entries(METHOD_GUARDED_ROUTES))
    nitroApp.router.use(path, methodNotAllowed(allowed));
});
