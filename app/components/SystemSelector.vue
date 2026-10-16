<script setup lang="ts">
import type { ResourceOptionItem } from "~/utils/resource-option";

// Header dropdown for the current system (see `useCurrentSystem`). `compact`:
// the sidebar is an icon rail, so show a globe button, naming the system in
// its tooltip, that opens the same menu beside the rail.
defineProps<{ compact?: boolean }>();
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
const selectedLabel = computed(
  () => items.value.find((item) => item.value === selected.value)?.label ?? "All Systems",
);
</script>

<template>
  <UTooltip :text="selectedLabel" :disabled="!compact" :content="{ side: 'right' }">
    <USelect
      v-model="selected"
      :content="compact ? { side: 'right', align: 'start', sideOffset: 12 } : { align: 'start' }"
      :items="items"
      size="md"
      :icon="compact ? 'i-lucide-globe' : undefined"
      :trailing-icon="compact ? '' : undefined"
      :aria-label="compact ? `Current system: ${selectedLabel}` : 'Current system'"
      :ui="
        compact
          ? {
              base: 'flex h-[35px] items-center justify-center bg-(--st-page) p-0',
              leading: 'static p-0',
              leadingIcon: 'size-[17px] text-default',
            }
          : { base: 'h-[35px] bg-(--st-page) text-sm text-highlighted', trailingIcon: 'size-3.5 text-default' }
      "
    >
      <template v-if="compact" #default>
        <span class="sr-only">{{ selectedLabel }}</span>
      </template>
      <template #item-label="{ item }">
        <ResourceOption :option="item as ResourceOptionItem" />
      </template>
    </USelect>
  </UTooltip>
</template>
