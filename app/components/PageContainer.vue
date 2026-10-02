<script setup lang="ts">
// The width and padding every page shares. `compact` tightens the spacing
// between the page's sections (the sheet editor).
defineProps<{ compact?: boolean }>();
</script>

<template>
  <div
    class="mx-auto w-full max-w-(--ui-container) px-4 pt-6 pb-10 sm:px-7 sm:pt-7"
    :class="compact ? 'space-y-4' : 'space-y-5'"
  >
    <slot />
  </div>
</template>
