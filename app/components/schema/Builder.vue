<script setup lang="ts">
import { builderErrors, type BuilderField } from "#shared/schema-builder";

// Editor for a content type's fields: rows with key, type, and settings,
// nested for groups and lists, reordered by dragging. Edits `fields` in
// place; the parent converts it with `builderToSchema` to save.
const fields = defineModel<BuilderField[]>({ required: true });
const props = defineProps<{
  contentTypes: { id: string; name: string }[];
  readonly?: boolean;
}>();

const errors = computed(() => builderErrors(fields.value));
provideSchemaBuilder({
  errors,
  contentTypeOptions: computed(() =>
    props.contentTypes.map((item) => ({ label: item.name, value: item.id })),
  ),
  readonly: computed(() => props.readonly === true),
});
</script>

<template>
  <SchemaFieldList v-model="fields" />
</template>
