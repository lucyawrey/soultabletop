<script setup lang="ts">
// Placeholder cards while a card list loads, shaped like `ResourceCards`
// (`variant="resource"`) or the dashboard's `RecentCard` rows
// (`variant="recent"`). One status region, as in `TableSkeleton`.
withDefaults(
  defineProps<{ cards?: number; variant?: "resource" | "recent" }>(),
  { cards: 3, variant: "resource" },
);
</script>

<template>
  <div role="status">
    <span class="sr-only">Loading</span>
    <ul
      v-if="variant === 'resource'"
      aria-hidden="true"
      class="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5"
    >
      <li
        v-for="card in cards"
        :key="card"
        class="flex flex-col gap-3 rounded-lg border border-default bg-default p-4"
      >
        <div class="h-6 w-2/3 animate-pulse rounded-md bg-elevated" />
        <div class="h-5 w-1/2 animate-pulse rounded-md bg-elevated" />
        <div class="flex gap-2">
          <div class="h-5 w-16 animate-pulse rounded-full bg-elevated" />
          <div class="h-5 w-14 animate-pulse rounded-full bg-elevated" />
        </div>
        <div class="mt-1 border-t border-default pt-2.5">
          <div class="h-3 w-1/3 animate-pulse rounded-md bg-elevated" />
        </div>
      </li>
    </ul>
    <ul
      v-else
      aria-hidden="true"
      class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"
    >
      <li
        v-for="card in cards"
        :key="card"
        class="flex items-center gap-3 rounded-lg border border-default bg-default p-3.5"
      >
        <div class="size-[42px] shrink-0 animate-pulse rounded-full bg-elevated" />
        <div class="min-w-0 flex-1 space-y-2">
          <div class="h-4 w-3/4 animate-pulse rounded-md bg-elevated" />
          <div class="h-3 w-1/2 animate-pulse rounded-md bg-elevated" />
        </div>
      </li>
    </ul>
  </div>
</template>
