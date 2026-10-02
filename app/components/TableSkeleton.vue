<script setup lang="ts">
// Placeholder rows for a table's `#empty` slot (or a list) while its data
// loads, so the "nothing here" message doesn't flash before the rows arrive.
// One status region for the group; plain elements rather than `USkeleton`,
// which would announce "loading" once per bar. Rows are about as tall as real
// table rows, with a wide bar for the name and short ones for the columns.
withDefaults(defineProps<{ rows?: number }>(), { rows: 3 });
</script>

<template>
  <div role="status" class="px-4 text-start">
    <span class="sr-only">Loading</span>
    <div
      v-for="row in rows"
      :key="row"
      aria-hidden="true"
      class="flex h-[52px] items-center gap-6 border-default not-last:border-b"
    >
      <div class="h-4 w-2/5 animate-pulse rounded-md bg-elevated" />
      <div class="h-3 w-1/6 animate-pulse rounded-md bg-elevated" />
      <div class="h-3 w-1/6 animate-pulse rounded-md bg-elevated max-sm:hidden" />
    </div>
  </div>
</template>
