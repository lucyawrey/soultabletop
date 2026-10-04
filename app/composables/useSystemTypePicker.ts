import type { ResourceSource } from "#shared/resource-list";

interface PickerType {
  id: string;
  name: string;
  systemId: string;
  source: ResourceSource;
}

// The System and Type fields of a create dialog. The System list holds the
// systems that have a type to offer, the Type list only the chosen system's
// types, and choosing a system preselects its most used type (counted over
// the whole site by `/api/most-used-content-types`).
export function useSystemTypePicker(
  form: { systemId: string; contentTypeId: string },
  types: Ref<PickerType[]>,
) {
  const { systems } = useSystems();
  const { systemId: currentSystemId } = useCurrentSystem();

  const systemOptions = computed(() => {
    const withTypes = new Set(types.value.map((item) => item.systemId));
    return systems.value
      .filter((system) => withTypes.has(system.id))
      .map((system) =>
        resourceOption(system.id, { name: system.name, source: system.source }),
      );
  });

  const systemTypes = computed(() =>
    types.value.filter((item) => item.systemId === form.systemId),
  );
  const typeOptions = computed(() =>
    systemTypes.value.map((item) =>
      resourceOption(item.id, { name: item.name, source: item.source }),
    ),
  );

  // Answers that arrive after the system or type changed again are dropped.
  let request = 0;
  async function selectMostUsedType() {
    const systemId = form.systemId;
    const current = ++request;
    form.contentTypeId = systemTypes.value[0]?.id ?? "";
    if (!systemId) return;
    try {
      const { ids } = await $fetch<{ ids: string[] }>(
        "/api/most-used-content-types",
        { query: { systemId } },
      );
      if (current !== request) return;
      const offered = new Set(systemTypes.value.map((item) => item.id));
      const mostUsed = ids.find((id) => offered.has(id));
      if (mostUsed) form.contentTypeId = mostUsed;
    } catch {
      // Keep the first type: the preselection is only a convenience.
    }
  }

  // Starts on the header's system when it has types here, else the first
  // system that does. If the systems list is still loading, it picks one
  // once the list arrives.
  let waitingForSystems = false;
  function selectStartingSystem() {
    const offered = systemOptions.value;
    waitingForSystems = offered.length === 0;
    form.systemId =
      offered.find((option) => option.value === currentSystemId.value)?.value ??
      offered[0]?.value ??
      "";
    return selectMostUsedType();
  }
  watch(systemOptions, (offered) => {
    if (waitingForSystems && offered.length > 0) selectStartingSystem();
  });

  function onSystemChange(systemId: string) {
    waitingForSystems = false;
    form.systemId = systemId;
    return selectMostUsedType();
  }

  // A type the user picked wins over a preselection still on its way.
  function onTypeChange(contentTypeId: string) {
    request++;
    form.contentTypeId = contentTypeId;
  }

  // A given type and its system, instead of the preselection.
  function selectType(contentTypeId: string) {
    const type = types.value.find((item) => item.id === contentTypeId);
    if (!type) return false;
    request++;
    waitingForSystems = false;
    form.systemId = type.systemId;
    form.contentTypeId = type.id;
    return true;
  }

  return {
    systemOptions,
    typeOptions,
    selectStartingSystem,
    selectType,
    onSystemChange,
    onTypeChange,
  };
}
