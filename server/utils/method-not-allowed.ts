import { createError, defineEventHandler, setResponseHeader } from "h3";

// h3's router (Nitro 2) has a fallback: when a request matches a route that has
// no handler for its method, it runs a handler for that method from another
// route matching the same path, with the first route's parameters. So
// `GET /api/campaign/<id>/members` (POST only) ran the campaign GET handler
// (through `[id]/[readableId].get.ts`, with no `readableId`) and returned the
// campaign, and `PATCH` ran the campaign PATCH handler.
//
// Routes where a static segment follows a route parameter can overlap a
// parameter route like that, so `server/plugins/method-not-allowed.ts` gives
// each of them a catch-all handler that answers 405: the router takes a
// route's own catch-all before falling back. `method-not-allowed.test.ts`
// checks this list against the files in `server/api`; add new routes of that
// shape here (paths as Nitro registers them, with the methods they have).
export const METHOD_GUARDED_ROUTES: Record<string, string[]> = {
  "/api/campaign/:id/members": ["POST"],
  "/api/campaign/:id/members/:userId": ["DELETE"],
  "/api/campaign/:id/:readableId/members": ["POST"],
  "/api/campaign/:id/:readableId/members/:userId": ["DELETE"],
  "/api/content-type/:id/preview": ["GET"],
  "/api/content-type/:id/:readableId/preview": ["GET"],
  "/api/group/:id/members": ["GET", "POST"],
  "/api/group/:id/members/:userId": ["DELETE"],
  "/api/resource/:id/grants": ["GET", "POST"],
  "/api/resource/:id/grants/:grantId": ["DELETE"],
};

export function methodNotAllowed(allowed: string[]) {
  return defineEventHandler((event) => {
    setResponseHeader(event, "allow", allowed.join(", "));
    throw createError({
      statusCode: 405,
      statusMessage: `Method ${event.method} is not allowed here`,
    });
  });
}
