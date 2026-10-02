<script setup lang="ts">
import type { ResourceSource } from "#shared/resource-list";
import type { SheetRef } from "#shared/sheet/runtime";
import { extractApiErrorMessage } from "~/utils/api-error";
import type { ResourceOptionItem } from "~/utils/resource-option";

// Searchable choice of existing Content of one ContentType, loaded each
// time it opens. Emits the picked Content so it can be shown before saving.
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

// The list leaves out each content's data, so the picked one's is loaded here.
const toast = useToast();
// The picker is disabled while that request runs, so picks can't overlap or
// arrive out of order.
const picking = ref(false);
async function select(id: unknown) {
  const item = options.value.find((option) => option.id === id);
  if (!item || picking.value) return;
  picking.value = true;
  try {
    const { data } = await $fetch<{ data: Record<string, unknown> }>(
      `/api/content/${item.id}`,
    );
    emit("pick", item.id, {
      name: item.name,
      contentTypeId: item.contentTypeId,
      data,
    });
  } catch (error) {
    toast.add({
      title: extractApiErrorMessage(error, "Could not load content."),
      color: "error",
    });
  } finally {
    picking.value = false;
  }
}
</script>

<template>
  <USelectMenu
    :model-value="modelValue"
    :items="items"
    value-key="value"
    :loading="loading || picking"
    :disabled="picking"
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
