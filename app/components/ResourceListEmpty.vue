<script setup lang="ts">
// The empty state of a resource list: what's missing, and when the header's
// system filter is on, a way to look past it. `list` is from `useResourceList`.
defineProps<{
  list: Awaited<ReturnType<typeof useResourceList>>;
  // Plural, lowercase: "sheets".
  plural: string;
  uncountable?: boolean;
}>();
</script>

<template>
  <TableSkeleton v-if="list.status.value === 'pending' || list.status.value === 'idle'" />
  <p v-else class="py-6 text-center text-sm text-muted">
    {{ list.emptyMessage(plural, uncountable) }}
    <UButton
      v-if="list.systemFilter.value"
      variant="link"
      size="sm"
      class="p-0"
      @click="list.showAllSystems()"
    >
      Show all systems
    </UButton>
  </p>
</template>
