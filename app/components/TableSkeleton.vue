<script setup lang="ts">
// Placeholder rows for a table's `#empty` slot (or a card list) while its data
// loads, so the "nothing here" message doesn't flash before the rows arrive.
// One status region for the group; plain elements rather than `USkeleton`,
// which would announce "loading" once per bar. Rows are about as tall as real
// table rows.
withDefaults(defineProps<{ rows?: number }>(), { rows: 3 });
</script>

<template>
  <div role="status">
    <span class="sr-only">Loading</span>
    <div
      v-for="row in rows"
      :key="row"
      aria-hidden="true"
      class="flex h-[52px] items-center"
    >
      <div class="h-4 w-full animate-pulse rounded-md bg-elevated" />
    </div>
  </div>
</template>
