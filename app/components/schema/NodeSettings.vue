<script setup lang="ts">
import {
  BUILDER_TYPE_LABELS,
  contentTypeErrorId,
  newBuilderNode,
  type BuilderFieldType,
  type BuilderNode,
} from "#shared/schema-builder";
import type { ContentFieldAllow } from "#shared/content-schema";

// Settings for a node's type: a group's fields, a list's item type (itself a
// node, so lists of groups or of lists work), or a content field's content
// type and allowed forms.
const node = defineModel<BuilderNode>({ required: true });
const { errors, contentTypeOptions, readonly } = useSchemaBuilder();

const typeOptions = (
  Object.entries(BUILDER_TYPE_LABELS) as [BuilderFieldType, string][]
).map(([value, label]) => ({ label, value }));

const allowOptions: { label: string; value: ContentFieldAllow }[] = [
  { label: "Existing or custom", value: "both" },
  { label: "Existing only", value: "ref" },
  { label: "Custom only", value: "local" },
];

// A new list starts with text items.
watch(
  () => node.value.type,
  (type) => {
    if (type === "array" && !node.value.item) node.value.item = newBuilderNode();
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="node.type === 'object'" class="space-y-2">
    <p class="text-sm font-medium text-highlighted">Fields</p>
    <SchemaFieldList v-model="node.fields" />
  </div>

  <div v-else-if="node.type === 'array' && node.item" class="space-y-2">
    <UFormField label="Item type">
      <USelect
        v-model="node.item.type"
        :items="typeOptions"
        class="w-40"
        :disabled="readonly"
      />
    </UFormField>
    <div
      v-if="['object', 'array', 'content'].includes(node.item.type)"
      class="border-s-2 border-default ps-3"
    >
      <SchemaNodeSettings v-model="node.item" />
    </div>
  </div>

  <div v-else-if="node.type === 'content'" class="grid gap-3 sm:grid-cols-2">
    <UFormField
      label="Content type"
      :error="errors.get(contentTypeErrorId(node.id))"
      required
    >
      <USelect
        v-model="node.contentTypeId"
        :items="contentTypeOptions"
        placeholder="Choose a content type"
        class="w-full"
        :disabled="readonly"
      />
    </UFormField>
    <UFormField label="Allow" description="Link existing content, fill in custom data, or both.">
      <USelect
        v-model="node.allow"
        :items="allowOptions"
        class="w-full"
        :disabled="readonly"
      />
    </UFormField>
  </div>
</template>
