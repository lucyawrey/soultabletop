<script setup lang="ts">
import type { ResourceSource } from "#shared/resource-list";
import type { SheetRef } from "#shared/sheet/runtime";
import type { ResourceOptionItem } from "~/utils/resource-option";

// Searchable choice of existing Content of one ContentType, loaded on first
// open. Emits the picked Content so it can be shown before saving.
const props = defineProps<{
  contentTypeId: string;
  modelValue?: string;
  placeholder?: string;
}>();
const emit = defineEmits<{ pick: [id: string, ref: SheetRef] }>();

interface ContentListItem {
  id: string;
  name: string;
  contentTypeId: string;
  source: ResourceSource;
  data: Record<string, unknown>;
}

const options = ref<ContentListItem[]>([]);
const loading = ref(false);

async function load(open: boolean) {
  // Loads on every open, so content created since the last open shows up.
  if (!open || loading.value) return;
  loading.value = true;
  try {
    options.value = await $fetch<ContentListItem[]>("/api/content", {
      query: { contentTypeId: props.contentTypeId },
    });
  } finally {
    loading.value = false;
  }
}

const items = computed(() =>
  options.value.map((item) =>
    resourceOption(item.id, {
      name: item.name,
      source: item.source,
    }),
  ),
);

function select(id: unknown) {
  const item = options.value.find((option) => option.id === id);
  if (item)
    emit("pick", item.id, {
      name: item.name,
      contentTypeId: item.contentTypeId,
      data: item.data,
    });
}
</script>

<template>
  <USelectMenu
    :model-value="modelValue"
    :items="items"
    value-key="value"
    :loading="loading"
    :placeholder="placeholder ?? 'Choose…'"
    class="w-full"
    @update:open="load"
    @update:model-value="select"
  >
    <template #item-label="{ item }">
      <ResourceOption :option="item as ResourceOptionItem" />
    </template>
  </USelectMenu>
</template>
