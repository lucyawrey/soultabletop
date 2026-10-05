import type { ContentCategory } from "#shared/content-categories";

interface FilterContentType {
  id: string;
  name: string;
  systemId: string;
  contentCategory: ContentCategory;
}

// The Characters and Content pages' filter dropdown: by content category, or,
// while a system is selected in the header, by that system's content types in
// the page's categories. Kept in the URL (`?category=` / `?type=`) so it
// survives reloads and links. `categoryLabels` names the page's categories
// (plural, as menu items); `extraQuery` is the list endpoint's part.
export function useContentListFilter(
  categoryLabels: Partial<Record<ContentCategory, string>>,
  allLabel: string,
  contentTypes: Ref<FilterContentType[]>,
) {
  const categories = Object.keys(categoryLabels) as ContentCategory[];
  const route = useRoute();
  const router = useRouter();
  const { systemId } = useCurrentSystem();

  const param = computed(() => (systemId.value ? "type" : "category"));
  const options = computed(() => [
    { label: allLabel, value: "all" },
    ...(systemId.value
      ? contentTypes.value
          .filter(
            (item) =>
              item.systemId === systemId.value &&
              categories.includes(item.contentCategory),
          )
          .map((item) => ({ label: item.name, value: item.id }))
      : categories.map((value) => ({
          label: categoryLabels[value]!,
          value,
        }))),
  ]);
  const label = computed(() =>
    systemId.value ? "Filter by content type" : "Filter by category",
  );

  function fromUrl() {
    const value = route.query[param.value];
    return typeof value === "string" && value ? value : "all";
  }
  // What the dropdown shows: "all" until the content types have loaded, or
  // when the URL names one this system doesn't have.
  const value = computed({
    get: () => {
      const current = fromUrl();
      return options.value.some((item) => item.value === current)
        ? current
        : "all";
    },
    set: (next: string) => {
      const query: Record<string, string> = {};
      for (const [key, item] of Object.entries(route.query))
        if (!["category", "type", "page"].includes(key) && typeof item === "string")
          query[key] = item;
      if (next !== "all") query[param.value] = next;
      router.replace({ query });
    },
  });

  // The list endpoint's filter: the chosen content type (within the page's
  // categories, so the server checks the type is readable) or category, else
  // all the page's categories. Until the content types load, a type in the
  // URL can't be checked, so the list starts unfiltered by it.
  const extraQuery = computed((): Record<string, string> => {
    const current = value.value;
    if (current === "all") return { categories: categories.join(",") };
    if (systemId.value)
      return { categories: categories.join(","), contentTypeId: current };
    return { categories: current };
  });

  return { value, options, label, extraQuery };
}
