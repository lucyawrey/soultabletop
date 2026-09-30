import { MAX_PAGE, type Paginated } from "../../shared/resource-list";

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
  } = {},
) {
  const hasTabs = options.tabs ?? true;
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
    ...(scope.value ? { scope: scope.value } : {}),
    ...(q.value ? { q: q.value } : {}),
    page: page.value,
  }));

  const request = useLazyFetch<Paginated<T>>(endpoint, {
    query,
    default: () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
  });
  const { data, status, refresh } = request;
  // A page past the end (an old link, or the last row of the last page was
  // deleted) goes back to the last page that exists.
  watch(
    () => [request.status.value, data.value] as const,
    ([state, result]) => {
      if (state !== "success" || page.value === 1 || result.items.length) return;
      const last = Math.max(1, Math.ceil(result.total / result.pageSize));
      if (last < page.value) setQuery({ page: last });
    },
  );
  await request;

  // What an empty list says: what's missing, for what was searched or shown.
  function emptyMessage(plural: string) {
    if (q.value) return `No ${plural} match your search.`;
    return scope.value === "public" ? `No public ${plural} yet.` : `No ${plural} yet.`;
  }

  return {
    loggedIn,
    hasTabs,
    tab,
    query: q,
    emptyMessage,
    search,
    page,
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
