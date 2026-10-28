<script setup lang="ts">
// A small icon button for sheet rows and fields (move, remove, reset, …): the
// same markup and look as a ghost `xs` UButton, which sheet CSS may target
// (`data-slot`, `aria-label`), without UButton's setup cost. A sheet in edit
// mode can have hundreds of these, and UButton made switching to edit slow.
withDefaults(
  defineProps<{
    icon: string;
    label: string;
    color?: "neutral" | "error";
    disabled?: boolean;
  }>(),
  { color: "neutral" },
);
</script>

<template>
  <button
    type="button"
    data-slot="base"
    :aria-label="label"
    :disabled="disabled"
    class="inline-flex items-center gap-1 rounded-md p-1 text-xs font-semibold transition-colors focus-visible:outline-3 disabled:cursor-not-allowed disabled:opacity-75 hover:disabled:bg-transparent"
    :class="
      color === 'error'
        ? 'text-error outline-error/25 hover:bg-error/10 active:bg-error/10'
        : 'text-default outline-inverted/25 hover:bg-elevated active:bg-elevated'
    "
  >
    <UIcon :name="icon" class="size-4 shrink-0" data-slot="leadingIcon" />
  </button>
</template>
