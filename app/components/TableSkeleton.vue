<script setup lang="ts">
// Placeholder rows for a table's `#empty` slot while its data loads, so the
// "nothing here" message doesn't flash before the rows arrive.
withDefaults(defineProps<{ rows?: number }>(), { rows: 5 });
</script>

<template>
  <div class="space-y-5 py-3" aria-busy="true" aria-label="Loading">
    <USkeleton v-for="row in rows" :key="row" class="h-5 w-full" />
  </div>
</template>
