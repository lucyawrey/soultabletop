<script setup lang="ts">
import type { ListView } from "~/composables/useListView";
import type { ResourceListTab } from "~/composables/useResourceList";

// Tabs (My / Find), search box, and pagination around a resource table; the
// table goes in the default slot. `list` is the result of `useResourceList`.
const props = defineProps<{
  list: Awaited<ReturnType<typeof useResourceList>>;
  // Plural, Title Case: "Sheets".
  noun: string;
  // Names this page's saved view (`useListView`), and what it shows until the
  // user picks one.
  viewKey: string;
  defaultView: ListView;
}>();

const view = useListView(props.viewKey, props.defaultView);

const tabs = computed(() => [
  { label: `My ${props.noun}`, value: "mine" },
  { label: `Find ${props.noun}`, value: "find" },
]);
</script>

<template>
  <div class="space-y-4">
    <!-- The tabs wrap above the search line at narrow widths; the view toggle
         stays at the end of the search line itself. Room for the future filter
         row goes below this. -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <UTabs
        v-if="list.hasTabs && list.loggedIn.value"
        :model-value="list.tab.value"
        :items="tabs"
        :content="false"
        variant="link"
        class="w-full sm:w-auto"
        @update:model-value="list.setTab($event as ResourceListTab)"
      />

      <div class="flex min-w-0 flex-[0_1_380px] items-center gap-2 max-sm:flex-1">
        <UInput
          :model-value="list.search.value"
          icon="i-lucide-search"
          :ui="{ base: 'h-10' }"
          :placeholder="`Search ${noun.toLowerCase()} by name or ID`"
          class="min-w-0 flex-1"
          @update:model-value="list.setSearch(String($event))"
        />
        <ListViewToggle v-model="view" />
      </div>
    </div>

    <slot v-if="view === 'cards'" name="cards" />
    <slot v-else />

    <div
      v-if="list.total.value > 0"
      class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted"
    >
      <span>
        {{ list.total.value }} {{ list.total.value === 1 ? "result" : "results" }}
      </span>
      <UPagination
        v-if="list.total.value > list.pageSize.value || list.page.value > 1"
        :page="list.page.value"
        :total="list.total.value"
        :items-per-page="list.pageSize.value"
        @update:page="list.setPage"
      />
      <span v-else>Page 1 of 1</span>
    </div>
  </div>
</template>
