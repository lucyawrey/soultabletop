<script setup lang="ts">
// The width and padding every page shares. `compact` tightens the spacing
// between the page's sections (the sheet editor).
defineProps<{ compact?: boolean }>();
</script>

<template>
  <div
    class="mx-auto w-full max-w-(--ui-container) p-4 py-8"
    :class="compact ? 'space-y-4' : 'space-y-6'"
  >
    <slot />
  </div>
</template>
