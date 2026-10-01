const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The system most pages are filtered by, kept in a cookie so the server
// renders the filtered lists. `null` means All Systems.
export function useCurrentSystem() {
  const cookie = useCookie<string | null>("current-system", {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    default: () => null,
  });
  // The server renders the page's components one after another and each
  // `useCookie` reads the request's cookie afresh, so a change made while
  // rendering (by the `current-system` middleware or `followSystem`) would not
  // reach components that were set up earlier or later. This state is shared
  // by all of them and carried to the client with the page.
  // Anything but a UUID (a hand-edited cookie) counts as All Systems.
  const fromCookie = () =>
    cookie.value && UUID_PATTERN.test(cookie.value) ? cookie.value : null;
  const state = useState<string | null>("current-system", fromCookie);
  // On the client the cookie can change under us (another tab picked a
  // system), so the state follows it. `setSystem` sets both, so this is a
  // no-op for our own changes.
  if (import.meta.client) {
    watch(cookie, () => {
      if (state.value !== fromCookie()) state.value = fromCookie();
    });
  }
  const systemId = computed(() => state.value);

  function setSystem(id: string | null) {
    state.value = id;
    cookie.value = id;
  }

  // For detail pages: opening a resource from another system while one is
  // selected switches the selection to that resource's system.
  function followSystem(id: string | null | undefined) {
    if (id && systemId.value && systemId.value !== id) setSystem(id);
  }

  return { systemId, setSystem, followSystem };
}
