<script setup lang="ts">
import type { SheetRef } from "#shared/sheet/runtime";

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
  data: Record<string, unknown>;
}

const options = ref<ContentListItem[]>([]);
const loading = ref(false);
const loaded = ref(false);

async function load(open: boolean) {
  if (!open || loaded.value || loading.value) return;
  loading.value = true;
  try {
    options.value = await $fetch<ContentListItem[]>("/api/content", {
      query: { contentTypeId: props.contentTypeId },
    });
    loaded.value = true;
  } finally {
    loading.value = false;
  }
}

const items = computed(() =>
  options.value.map((item) => ({ label: item.name, value: item.id })),
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
  />
</template>
