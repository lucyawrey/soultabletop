import { setHeader } from "h3";
import {
  createRequestTiming,
  currentRequestTiming,
  runWithRequestTiming,
  formatServerTiming,
  isServerTimingEnabled,
  type RequestTiming,
} from "../utils/server-timing";

// Adds a `Server-Timing` header (database time, query count, total time) to
// every response when enabled: on in development, off in production unless
// `SERVER_TIMING` is set to 1/true. The header carries numbers only.
export default defineNitroPlugin((nitroApp) => {
  const enabled = isServerTimingEnabled(
    process.env.SERVER_TIMING,
    import.meta.dev,
  );
  if (!enabled) return;

  // Wrap the whole request so the timing is current for every query it makes
  // (a hook cannot do this: it runs in its own async context).
  const handler = nitroApp.h3App.handler;
  nitroApp.h3App.handler = (event) => {
    // An internal call (SSR `$fetch` to `/api/...`) joins the outer request's
    // timing and writes no header of its own.
    const outer = currentRequestTiming();
    if (outer) return handler(event);
    const timing = createRequestTiming();
    event.context.serverTiming = timing;
    return runWithRequestTiming(timing, () => handler(event));
  };

  nitroApp.hooks.hook("beforeResponse", (event) => {
    const timing = event.context.serverTiming as RequestTiming | undefined;
    if (!timing) return;
    setHeader(
      event,
      "Server-Timing",
      formatServerTiming(timing, performance.now()),
    );
  });
});
