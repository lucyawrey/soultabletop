<script setup lang="ts">
import {
  RESOURCE_LINK_KINDS,
  type ResourceLinkKind,
} from "#shared/content-schema";
import { schemaDisplayName } from "#shared/schema-builder";
import type { SheetLink } from "#shared/sheet/runtime";

// Searchable choice of a readable resource for a `resourceLink` field, loaded
// on first open. Fields without a `kind` get a kind choice first. Emits the
// picked resource so it can be shown before saving.
const props = defineProps<{
  kind?: ResourceLinkKind;
  modelValue?: string;
  placeholder?: string;
}>();
const emit = defineEmits<{ pick: [id: string, link: SheetLink] }>();

const LIST_URLS: Record<ResourceLinkKind, string> = {
  system: "/api/system",
  campaign: "/api/campaign",
  contentType: "/api/content-type",
  sheet: "/api/sheet",
  content: "/api/content",
};

const chosenKind = ref<ResourceLinkKind>(props.kind ?? "content");
const kind = computed(() => props.kind ?? chosenKind.value);
const kindOptions = RESOURCE_LINK_KINDS.map((value) => ({
  label: schemaDisplayName(value),
  value,
}));

const options = ref<{ id: string; name: string }[]>([]);
const loading = ref(false);
const loadedKind = ref<ResourceLinkKind>();

async function load(open: boolean) {
  if (!open || loadedKind.value === kind.value || loading.value) return;
  loading.value = true;
  try {
    const listKind = kind.value;
    options.value = await $fetch<{ id: string; name: string }[]>(
      LIST_URLS[listKind],
    );
    loadedKind.value = listKind;
  } finally {
    loading.value = false;
  }
}

const items = computed(() =>
  options.value.map((item) => ({ label: item.name, value: item.id })),
);

function select(id: unknown) {
  const item = options.value.find((option) => option.id === id);
  if (item) emit("pick", item.id, { name: item.name, kind: kind.value });
}
</script>

<template>
  <div class="flex gap-2">
    <USelect
      v-if="!props.kind"
      v-model="chosenKind"
      :items="kindOptions"
      aria-label="kind"
      class="w-36 shrink-0"
    />
    <USelectMenu
      :key="kind"
      :model-value="modelValue"
      :items="items"
      value-key="value"
      :loading="loading"
      :placeholder="placeholder ?? 'Choose…'"
      class="min-w-0 flex-1"
      @update:open="load"
      @update:model-value="select"
    />
  </div>
</template>
