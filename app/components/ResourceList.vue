<script setup lang="ts">
import type { ResourceListTab } from "~/composables/useResourceList";

// Tabs (My / Find), search box, and pagination around a resource table; the
// table goes in the default slot. `list` is the result of `useResourceList`.
const props = defineProps<{
  list: Awaited<ReturnType<typeof useResourceList>>;
  // Plural, Title Case: "Sheets".
  noun: string;
}>();

const tabs = computed(() => [
  { label: `My ${props.noun}`, value: "mine" },
  { label: `Find ${props.noun}`, value: "find" },
]);
</script>

<template>
  <div class="space-y-4">
    <UTabs
      v-if="list.hasTabs && list.loggedIn.value"
      :model-value="list.tab.value"
      :items="tabs"
      :content="false"
      @update:model-value="list.setTab($event as ResourceListTab)"
    />

    <UInput
      :model-value="list.search.value"
      icon="i-lucide-search"
      :placeholder="`Search ${noun.toLowerCase()} by name or ID`"
      class="w-full max-w-md"
      @update:model-value="list.setSearch(String($event))"
    />

    <slot />

    <div v-if="list.total.value > list.pageSize.value || list.page.value > 1" class="flex justify-center">
      <UPagination
        :page="list.page.value"
        :total="list.total.value"
        :items-per-page="list.pageSize.value"
        @update:page="list.setPage"
      />
    </div>
  </div>
</template>
