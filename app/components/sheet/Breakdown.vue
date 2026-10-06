<script setup lang="ts">
// The breakdown popover of a number with <Part>s: the number (the slot) is a
// button with a dotted underline, and clicking it lists the parts under it,
// like "Dex +3 · Trained +3 = 18". Clicking again, clicking elsewhere, or
// Escape closes it; it floats, so nothing moves.
defineProps<{
  parts: { label: string; text: string }[];
  total: string;
  // Names the button for screen readers.
  label: string;
}>();
</script>

<template>
  <UPopover :content="{ side: 'bottom', align: 'start' }">
    <button
      type="button"
      class="sheet-breakdown-trigger cursor-pointer underline decoration-dotted decoration-1 underline-offset-4 hover:decoration-solid"
      :aria-label="`${label}: show its parts`"
    >
      <slot />
    </button>
    <template #content>
      <p class="sheet-breakdown max-w-90 px-2 py-1 text-xs text-muted">
        <template v-for="(part, index) in parts" :key="index">
          <span v-if="index"> · </span>
          <span class="whitespace-nowrap">
            {{ part.label }} <b class="text-highlighted tabular-nums">{{ part.text }}</b>
          </span>
        </template>
        = <b class="text-highlighted tabular-nums">{{ total }}</b>
      </p>
    </template>
  </UPopover>
</template>
