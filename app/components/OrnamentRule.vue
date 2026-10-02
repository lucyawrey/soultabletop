<script setup lang="ts">
// A thin rule with the theme's ornament in the middle, between a detail page's
// header and its panels. Decorative only.
</script>

<template>
  <div
    aria-hidden="true"
    class="flex items-center gap-2.5 text-sm text-default before:h-px before:flex-1 before:bg-(--ui-border) before:content-[''] after:h-px after:flex-1 after:bg-(--ui-border) after:content-[''] print:hidden"
  >
    <span class="text-secondary">❦</span>
  </div>
</template>
