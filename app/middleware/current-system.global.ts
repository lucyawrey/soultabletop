// Applies the current-system cookie before the first server render, so the
// header selector and the filtered lists start out right (the client keeps
// them in line afterwards, see `SystemSelector` and `followSystem`):
// - opening a resource from another system switches the cookie to its system,
//   which `followSystem` does too, but only after the header has rendered;
// - a system that was deleted or is no longer readable is reset to All Systems.
// Runs only on the server's first render and only when the cookie is set, so
// it costs one or two extra requests then and nothing otherwise.
const RESOURCE_ENDPOINTS: Record<string, string> = {
  campaigns: "campaign",
  characters: "content",
  content: "content",
  sheets: "sheet",
  systems: "system",
  types: "content-type",
};

export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.server) return;
  const { systemId, setSystem } = useCurrentSystem();
  if (!systemId.value) return;

  const fetchApi = useRequestFetch();
  let current = systemId.value;
  let verified = false;

  const [section, resourceId] = to.path.split("/").filter(Boolean);
  const endpoint = section && RESOURCE_ENDPOINTS[section];
  if (endpoint && resourceId) {
    try {
      const item = await fetchApi<{ id: string; systemId?: string | null }>(
        `/api/${endpoint}/${resourceId}`,
      );
      const target = endpoint === "system" ? item.id : item.systemId;
      if (target && target !== current) current = target;
      else if (endpoint === "system") verified = true;
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
  setSystem(current || null);
});
