<script setup lang="ts">
import type { ListView } from "~/composables/useListView";

// The table / cards switch at the end of a list's search line (see
// `useListView`). Pressed buttons use the same solid fill as the current page.
const view = defineModel<ListView>({ required: true });

const options = [
  { value: "table", label: "Table view", icon: "i-lucide-table" },
  { value: "cards", label: "Cards view", icon: "i-lucide-layout-grid" },
] as const;
</script>

<template>
  <UFieldGroup class="shrink-0" role="group" aria-label="View">
    <UButton
      v-for="option in options"
      :key="option.value"
      :icon="option.icon"
      :aria-label="option.label"
      :aria-pressed="view === option.value"
      :title="option.label"
      :color="view === option.value ? 'primary' : 'neutral'"
      :variant="view === option.value ? 'solid' : 'outline'"
      @click="view = option.value"
    />
  </UFieldGroup>
</template>
