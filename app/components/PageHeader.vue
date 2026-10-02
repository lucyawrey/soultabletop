<script setup lang="ts">
// A page's title row: an optional small eyebrow above the title, and the
// page's actions (buttons) at the end. The title is the display font.
defineProps<{ title: string; eyebrow?: string }>();
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="min-w-0">
      <p
        v-if="eyebrow"
        class="text-xs font-semibold tracking-wide text-muted uppercase"
      >
        {{ eyebrow }}
      </p>
      <h1 class="text-2xl font-bold text-highlighted">{{ title }}</h1>
    </div>
    <div v-if="$slots.default" class="flex print:hidden flex-wrap items-center gap-2">
      <slot />
    </div>
  </div>
</template>
