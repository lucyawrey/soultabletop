<script setup lang="ts">
// The empty state of a resource list: what's missing, and when the header's
// system filter is on, a way to look past it. `list` is from `useResourceList`.
//
// Next steps: a search with no matches offers "Clear search"; an empty My list
// offers the page's create button when the page passes `createLabel`
// ("New Sheet"), disabled with `createDisabled` while something it needs is
// missing (the page explains what above the list).
const props = defineProps<{
  list: Awaited<ReturnType<typeof useResourceList>>;
  // Plural, lowercase: "sheets".
  plural: string;
  uncountable?: boolean;
  createLabel?: string;
  createDisabled?: boolean;
}>();
defineEmits<{ create: [] }>();

const canCreate = computed(
  () =>
    !!props.createLabel &&
    props.list.loggedIn.value &&
    !props.list.search.value &&
    (!props.list.hasTabs || props.list.tab.value === "mine"),
);
</script>

<template>
  <TableSkeleton v-if="isLoading(list.status.value)" />
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
    <UButton
      v-if="list.search.value"
      variant="link"
      size="sm"
      class="p-0"
      @click="list.setSearch('')"
    >
      Clear search
    </UButton>
    <UButton
      v-else-if="canCreate"
      icon="i-lucide-plus"
      size="sm"
      variant="outline"
      class="ms-2"
      :disabled="createDisabled"
      @click="$emit('create')"
    >
      {{ createLabel }}
    </UButton>
  </p>
</template>
