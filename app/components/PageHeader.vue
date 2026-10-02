<script setup lang="ts">
// A page's title row: an optional small eyebrow above the title, and the
// page's actions (buttons) at the end. The title is the display font.
defineProps<{ title: string; eyebrow?: string }>();
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <p
        v-if="eyebrow"
        class="mb-1 text-xs font-bold tracking-[0.1em] text-muted uppercase"
      >
        {{ eyebrow }}
      </p>
      <h1 class="text-[34px] leading-[1.05] font-bold text-highlighted">
        {{ title }}
      </h1>
    </div>
    <div v-if="$slots.default" class="flex print:hidden flex-wrap items-center gap-2">
      <slot />
    </div>
  </div>
</template>
