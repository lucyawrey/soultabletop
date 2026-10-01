import { parseResourcePagePath } from "#shared/resource-address";

// Applies the current-system cookie before the first server render, so the
// header selector and the filtered lists start out right (the client keeps
// them in line afterwards, see `SystemSelector` and `followSystem`):
// - opening a resource from another system switches the cookie to its system,
//   which `followSystem` does too, but only after the header has rendered;
// - a system that was deleted or is no longer readable is reset to All Systems.
// Runs only on the server's first render and only when the cookie is set, so
// it costs one or two light requests then and nothing otherwise. For a
// resource page it asks `/api/resource/lookup` (ID and system only, with the
// same access check as the resource's own GET) rather than the page's full
// GET, which for content and sheets does heavy work the page then repeats.
export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.server) return;
  const { systemId, setSystem } = useCurrentSystem();
  const original = systemId.value;
  if (!original) return;

  const fetchApi = useRequestFetch();
  let current = original;
  // Whether `current` was just looked up as a system, so it is known readable.
  let verified = false;

  // `/<section>/<id>[/...]` or `/<section>/<owner>/<readableId>[/...]`.
  const page = parseResourcePagePath(to.path);
  if (page) {
    const { address, kind } = page;
    try {
      const item = await fetchApi<{ systemId: string | null }>("/api/resource/lookup", {
        query: { kind, ...address },
      });
      if (item.systemId) {
        current = item.systemId;
        verified = kind === "system";
      }
    } catch {
      // The page shows its own not-found state.
    }
  }

  if (!verified) {
    try {
      await fetchApi(`/api/system/${current}`);
    } catch (error) {
      const { status, statusCode } = error as { status?: number; statusCode?: number };
      const code = status ?? statusCode;
      if (code === 404 || code === 403) current = "";
    }
  }
  // Setting the cookie sends it again with a fresh expiry, so only on change.
  if ((current || null) !== original) setSystem(current || null);
});
