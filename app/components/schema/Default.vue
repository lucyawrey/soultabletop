<script setup lang="ts">
import { defaultErrorId, type BuilderNode } from "#shared/schema-builder";

// A field's `default`: the starting value of new content and of new List
// items. Text, number, and choice fields take a plain value; `scalar` and
// `array` take JSON. Empty means no default.
const node = defineModel<BuilderNode>({ required: true });
const { errors, readonly } = useSchemaBuilder();

const isChoice = computed(
  () =>
    node.value.type === "boolean" ||
    ((node.value.type === "string" || node.value.type === "number") && node.value.hasOptions),
);
// Select items can't have an empty value, so this stands for no default.
const none = "__no_default__";
const choice = computed({
  get: () => node.value.defaultText || none,
  set: (value: string) => {
    node.value.defaultText = value === none ? "" : value;
  },
});
const choiceItems = computed(() => [
  { label: "(None)", value: none },
  ...(node.value.type === "boolean"
    ? ["true", "false"].map((value) => ({ label: value, value }))
    : node.value.options
        .filter((option) => option.value.trim())
        .map((option) => ({ label: option.label.trim() || option.value, value: option.value }))),
]);
</script>

<template>
  <UFormField
    size="md"
    label="Default"
    hint="Optional"
    :description="
      node.type === 'array'
        ? 'Starting items for new content, as a JSON array.'
        : 'Starting value for new content and new items.'
    "
    :error="errors.get(defaultErrorId(node.id))"
  >
    <USelect
      v-if="isChoice"
      v-model="choice"
      :items="choiceItems"
      class="w-48"
      :disabled="readonly"
    />
    <UTextarea
      v-else-if="node.type === 'array'"
      v-model="node.defaultText"
      :rows="3"
      autoresize
      placeholder='[{ "name": "Unarmed", "bonus": 0 }]'
      class="w-full font-mono"
      :disabled="readonly"
    />
    <UInput
      v-else
      v-model="node.defaultText"
      :placeholder="
        node.type === 'scalar'
          ? 'JSON, like &quot;Medium&quot;, 3, true, or null'
          : node.type === 'number'
            ? 'Number'
            : 'Text'
      "
      :inputmode="node.type === 'number' ? 'decimal' : undefined"
      :class="['w-full', node.type === 'scalar' && 'font-mono']"
      :disabled="readonly"
    />
  </UFormField>
</template>
