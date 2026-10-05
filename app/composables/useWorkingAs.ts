const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The group the user is "working as", set from the user menu: create dialogs'
// Owner field starts on it (still changeable per dialog). Kept per browser in
// a cookie, like the current system, and shared across components the same
// way (see `useCurrentSystem`). It clears itself once the groups load and it
// isn't one the user can create resources for any more (`useOwnerGroups`).
export function useWorkingAs() {
  const cookie = useCookie<string | null>("working-as", {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    default: () => null,
  });
  const fromCookie = () =>
    cookie.value && UUID_PATTERN.test(cookie.value) ? cookie.value : null;
  const state = useState<string | null>("working-as", fromCookie);
  if (import.meta.client) {
    watch(cookie, () => {
      if (state.value !== fromCookie()) state.value = fromCookie();
    });
  }

  const { groups, status } = useOwnerGroups();
  const group = computed(() =>
    state.value
      ? groups.value.find((item) => item.id === state.value)
      : undefined,
  );

  function setGroup(id: string | null) {
    state.value = id;
    cookie.value = id;
  }

  if (import.meta.client) {
    watch(
      [group, status],
      () => {
        if (status.value === "success" && state.value && !group.value)
          setGroup(null);
      },
      { immediate: true },
    );
  }

  return { group, groups, setGroup };
}
