<script setup lang="ts">
import {
  BUILDER_FIELD_TYPES,
  contentTypeErrorId,
  newBuilderNode,
  type BuilderNode,
} from "#shared/schema-builder";
import type { ContentFieldAllow } from "#shared/content-schema";

// Settings for a node's type: an `object`'s entries, an `array`'s itemType
// (itself a node, so arrays of objects or of arrays work), or a `content`
// field's contentTypeId and allow.
const node = defineModel<BuilderNode>({ required: true });
const { errors, contentTypeOptions, readonly } = useSchemaBuilder();

const typeOptions = BUILDER_FIELD_TYPES.map((type) => ({
  label: type,
  value: type,
}));

const allowOptions: { label: string; value: ContentFieldAllow }[] = [
  { label: "both", value: "both" },
  { label: "ref", value: "ref" },
  { label: "local", value: "local" },
];

// A new `array` starts with `string` items.
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
    <p class="text-sm font-medium text-highlighted">entries</p>
    <SchemaFieldList v-model="node.fields" />
  </div>

  <div v-else-if="node.type === 'array' && node.item" class="space-y-2">
    <UFormField label="itemType">
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
      label="contentTypeId"
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
    <UFormField
      label="allow"
      description="ref: existing content only. local: custom data only. both: either."
    >
      <USelect
        v-model="node.allow"
        :items="allowOptions"
        class="w-full"
        :disabled="readonly"
      />
    </UFormField>
  </div>
</template>
