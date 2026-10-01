import type { ResourceSource } from "#shared/resource-list";

interface SystemSummary {
  id: string;
  name: string;
  source: ResourceSource;
}

// The systems the viewer can read, shared with the header's system selector
// (same key, so a refresh there refreshes this). A system the viewer can't
// read isn't in the list, so it shows as "Unknown" once the list has loaded,
// never by name.
export function useSystems() {
  const { data: systems, status } = useLazyFetch<SystemSummary[]>(
    "/api/system",
    { key: "system-selector", default: () => [] },
  );
  const loaded = computed(
    () => status.value !== "idle" && status.value !== "pending",
  );

  function findSystem(systemId: string | null | undefined) {
    return systemId
      ? systems.value.find((item) => item.id === systemId)
      : undefined;
  }

  // The system's name, "Unknown" when the viewer can't read it, and
  // `undefined` while the list is still loading.
  function systemLabel(systemId: string | null | undefined) {
    const found = findSystem(systemId);
    if (found) return found.name;
    return loaded.value ? "Unknown" : undefined;
  }

  return { systems, status, loaded, findSystem, systemLabel };
}
