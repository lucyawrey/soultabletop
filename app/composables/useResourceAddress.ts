import {
  readableResourcePagePath,
  type ResourcePageSection,
} from "#shared/resource-address";

// Resource detail pages answer at `/<section>/<id>` and at
// `/<section>/<owner>/<readableId>` (the same page file under two routes, see
// `addReadableResourceRoutes` in nuxt.config.ts). This is the API path for the
// resource the current route shows, in the same form, e.g. `/api/sheet/<id>`
// or `/api/sheet/lucy/fighter`. Requests that change the resource use its ID
// from the response instead.
export function useResourceApiPath(apiBase: string) {
  const { id, owner, readableId } = useRoute().params;
  const segments = readableId === undefined ? [id] : [owner, readableId];
  return `${apiBase}/${segments.map((segment) => encodeURIComponent(String(segment ?? ""))).join("/")}`;
}

interface ReadableResource {
  readableId: string;
  ownerReadableId?: string | null;
}

// Shows the resource's owner + readable ID address in the address bar (e.g.
// `/sheets/<id>` becomes `/sheets/lucy/fighter`, `suffix` "/edit" for a
// subpage), without navigating: no reload, no second fetch. Follows renames
// while the page is open. Links the app offers keep using IDs, which never
// change; this only changes what the address bar shows. Resources with no
// such address (`readableResourcePagePath`) keep the URL they were opened at.
export function useReadableAddress(
  section: ResourcePageSection,
  item: Ref<ReadableResource | null | undefined>,
  suffix = "",
) {
  if (import.meta.server) return;
  // The path this page shows, to leave the address bar alone once it shows
  // something else.
  let shown = useRoute().path;
  // After mounting, so hydration sees the URL the server rendered.
  onMounted(() => {
    watch(
      () => [item.value?.ownerReadableId, item.value?.readableId],
      () => {
        const path = readableResourcePagePath(
          section,
          item.value?.ownerReadableId,
          item.value?.readableId,
          suffix,
        );
        if (!path || path === shown || window.location.pathname !== shown) return;
        const url = `${path}${window.location.search}${window.location.hash}`;
        // Vue Router keeps the current URL in `history.state.current` and
        // writes it back on the next navigation, so it gets the new one too.
        window.history.replaceState({ ...window.history.state, current: url }, "", url);
        shown = path;
      },
      { immediate: true },
    );
  });
}

// `useFetch` of the resource the current route shows (`useResourceApiPath`).
// Refreshes go by ID, so they still find it after a rename changes its
// owner + readable ID address.
export function useResourceFetch<T extends { id: string }>(apiBase: string) {
  const path = useResourceApiPath(apiBase);
  const id = ref<string>();
  const result = useFetch<T>(() => (id.value ? `${apiBase}/${id.value}` : path), {
    key: `resource:${path}`,
    watch: false,
  });
  watch(
    result.data,
    (value) => {
      const loaded = (value as { id?: string } | null | undefined)?.id;
      if (loaded) id.value = loaded;
    },
    { immediate: true },
  );
  return result;
}
