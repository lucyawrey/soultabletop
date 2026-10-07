<script setup lang="ts">
import type { SheetLayout } from "~/composables/useSheetLayout";

// The side by side / stacked switch for a sheet's code and preview (see
// `useSheetLayout`), styled like `ListViewToggle`. Hidden on narrow screens,
// where they always stack.
const layout = defineModel<SheetLayout>({ required: true });

const options = [
  { value: "columns", label: "Side by side", icon: "i-lucide-columns-2" },
  { value: "stacked", label: "Stacked", icon: "i-lucide-rows-2" },
] as const;
</script>

<template>
  <div
    role="group"
    aria-label="Layout"
    class="hidden shrink-0 rounded-md bg-default p-[3px] ring ring-inset ring-accented lg:inline-flex"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-label="option.label"
      :aria-pressed="layout === option.value"
      :title="option.label"
      class="grid size-[30px] place-items-center rounded-[6px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :class="layout === option.value ? 'bg-primary text-inverted' : 'text-muted hover:bg-elevated hover:text-default'"
      @click="layout = option.value"
    >
      <UIcon :name="option.icon" class="size-4" />
    </button>
  </div>
</template>
