<script setup lang="ts">
// Header dropdown for the current system (see `useCurrentSystem`).
const ALL = "all";

const { systemId, setSystem } = useCurrentSystem();
const { data: systems } = await useFetch<{ id: string; name: string }[]>(
  "/api/system",
  { key: "system-selector", default: () => [] },
);

// A saved system that was deleted or is no longer readable goes back to all.
if (systemId.value && !systems.value.some((item) => item.id === systemId.value))
  setSystem(null);

const items = computed(() => [
  { label: "All Systems", value: ALL },
  ...systems.value.map((item) => ({ label: item.name, value: item.id })),
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
    size="sm"
    aria-label="Current system"
    class="w-44"
  />
</template>
