<script setup lang="ts">
import type { ResourceOptionItem } from "~/utils/resource-option";

// Header dropdown for the current system (see `useCurrentSystem`).
const ALL = "all";

const { systemId, setSystem } = useCurrentSystem();
const loggedIn = await useLoggedIn();
const { systems, loaded, refresh } = useSystems();

// The list changes on sign-in and sign-out, and after system changes (the
// Systems and Groups pages call `refreshSystems()`).
watch(loggedIn, () => refresh());

// A saved system that was deleted or is no longer readable goes back to all.
function dropMissingSystem() {
  if (loaded.value && systemId.value && !systems.value.some((item) => item.id === systemId.value))
    setSystem(null);
}
dropMissingSystem();
watch([systems, loaded], dropMissingSystem);

const items = computed(() => [
  { label: "All Systems", value: ALL },
  ...systems.value.map((item) =>
    resourceOption(item.id, { name: item.name, source: item.source }),
  ),
]);
const selected = computed({
  get: () => systemId.value ?? ALL,
  set: (value: string) => setSystem(value === ALL ? null : value),
});
</script>

<template>
  <USelect
    v-model="selected"
    :items="items"
    size="md"
    aria-label="Current system"
    class="w-44"
    :ui="{ base: 'h-[35px] bg-(--st-page) text-sm text-default', trailingIcon: 'size-3.5 text-default', content: 'w-max min-w-80 max-w-[min(28rem,calc(100vw-2rem))]' }"
  >
    <template #item-label="{ item }">
      <ResourceOption :option="item as ResourceOptionItem" />
    </template>
  </USelect>
</template>
