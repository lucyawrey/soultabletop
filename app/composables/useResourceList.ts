import { MAX_PAGE, type Paginated } from "#shared/resource-list";

export type ResourceListTab = "mine" | "find";

// State for a resource list page: the tab, search text, and page live in the
// URL (`?tab=find&q=dragon&page=2`) so they survive reloads and links. Logged-
// out visitors only get the Find tab. `extraQuery` adds endpoint filters.
export async function useResourceList<T>(
  endpoint: string,
  // From `await useLoggedIn()` in the page; it has to be awaited there, since
  // a composable that awaits loses the Nuxt instance for what follows.
  loggedIn: Ref<boolean>,
  options: {
    extraQuery?: MaybeRefOrGetter<Record<string, string>>;
    // False for lists that need an account anyway (campaigns): one list, no
    // My / Find split, still searchable and paged.
    tabs?: boolean;
    // Filter by the header's current system (`?systemId=`). For lists tied to
    // a system; not the Systems list.
    bySystem?: boolean;
  } = {},
) {
  const hasTabs = options.tabs ?? true;
  const { systemId } = useCurrentSystem();
  const route = useRoute();
  const router = useRouter();

  function first(value: unknown) {
    return String(Array.isArray(value) ? value[0] : (value ?? ""));
  }

  const tab = computed<ResourceListTab>(() =>
    loggedIn.value && first(route.query.tab) !== "find" ? "mine" : "find",
  );
  const scope = computed(() =>
    !hasTabs ? undefined : tab.value === "mine" ? "mine" : "public",
  );
  const q = computed(() => first(route.query.q).trim());
  const page = computed(() => {
    const text = first(route.query.page);
    return /^\d+$/.test(text) ? Math.min(Math.max(Number(text), 1), MAX_PAGE) : 1;
  });

  function setQuery(changes: { tab?: string; q?: string; page?: number }) {
    const next: Record<string, string> = {};
    const merged = {
      tab: tab.value,
      q: q.value,
      page: page.value,
      ...changes,
    };
    if (hasTabs && merged.tab === "find" && loggedIn.value) next.tab = "find";
    if (merged.q) next.q = merged.q;
    if (merged.page > 1) next.page = String(merged.page);
    return router.replace({ query: next });
  }

  // The search box edits `search` right away; the URL (and so the request)
  // follows once typing pauses.
  const search = ref(q.value);
  watch(q, (value) => {
    if (value !== search.value.trim()) search.value = value;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(search, (value) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (value.trim() !== q.value) setQuery({ q: value.trim(), page: 1 });
    }, 300);
  });
  onScopeDispose(() => clearTimeout(timer));

  const query = computed(() => ({
    ...toValue(options.extraQuery),
    ...(options.bySystem && systemId.value ? { systemId: systemId.value } : {}),
    ...(scope.value ? { scope: scope.value } : {}),
    ...(q.value ? { q: q.value } : {}),
    page: page.value,
  }));

  const request = useLazyFetch<Paginated<T>>(endpoint, {
    query,
    default: () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
  });
  const { data, status, refresh } = request;
  // The endpoint returns the last page for a page past the end (an old link,
  // or the last row of the last page was deleted); put that page in the URL.
  // Client only: the server can't change the address during render.
  watch(
    () => [status.value, data.value.page] as const,
    ([state, current]) => {
      if (import.meta.client && state === "success" && current !== page.value)
        setQuery({ page: current });
    },
    { immediate: true },
  );
  await request;

  // What an empty list says: what's missing, for what was searched or shown.
  // `uncountable` is for nouns like "content" that take "matches".
  function emptyMessage(plural: string, uncountable = false) {
    if (data.value.total > 0) return "No results on this page.";
    if (q.value)
      return `No ${plural} ${uncountable ? "matches" : "match"} your search.`;
    return scope.value === "public" ? `No public ${plural} yet.` : `No ${plural} yet.`;
  }

  return {
    loggedIn,
    hasTabs,
    tab,
    query: q,
    emptyMessage,
    search,
    page: computed(() => data.value.page),
    items: computed(() => data.value.items),
    total: computed(() => data.value.total),
    pageSize: computed(() => data.value.pageSize),
    status,
    refresh,
    setSearch: (value: string) => (search.value = value),
    setTab: (value: ResourceListTab) => setQuery({ tab: value, page: 1 }),
    setPage: (value: number) => setQuery({ page: value }),
  };
}
