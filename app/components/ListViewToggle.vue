<script setup lang="ts">
import type { ListView } from "~/composables/useListView";

// The table / cards switch at the end of a list's search line (see
// `useListView`): one bordered box with two icon buttons, the pressed one in
// the same solid fill as the current page.
const view = defineModel<ListView>({ required: true });

const options = [
  { value: "table", label: "Table view", icon: "i-lucide-list" },
  { value: "cards", label: "Cards view", icon: "i-lucide-layout-grid" },
] as const;
</script>

<template>
  <div
    role="group"
    aria-label="View"
    class="inline-flex shrink-0 rounded-md border border-accented bg-default p-0.5"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-label="option.label"
      :aria-pressed="view === option.value"
      :title="option.label"
      class="grid size-[34px] place-items-center rounded-[6px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :class="view === option.value ? 'bg-primary text-inverted' : 'text-muted hover:bg-muted hover:text-default'"
      @click="view = option.value"
    >
      <UIcon :name="option.icon" class="size-4" />
    </button>
  </div>
</template>
