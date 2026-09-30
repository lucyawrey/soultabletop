// The system most pages are filtered by, kept in a cookie so the server
// renders the filtered lists. `null` means All Systems.
export function useCurrentSystem() {
  const cookie = useCookie<string | null>("current-system", {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    default: () => null,
  });
  const systemId = computed(() => cookie.value || null);

  function setSystem(id: string | null) {
    cookie.value = id;
  }

  // For detail pages: opening a resource from another system while one is
  // selected switches the selection to that resource's system.
  function followSystem(id: string | null | undefined) {
    if (id && systemId.value && systemId.value !== id) setSystem(id);
  }

  return { systemId, setSystem, followSystem };
}
