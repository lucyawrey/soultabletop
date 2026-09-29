<script setup lang="ts">
import { useSortable } from "@vueuse/integrations/useSortable";
import { newBuilderField, type BuilderField } from "#shared/schema-builder";

// One level of fields (the top level, or a group's fields), reordered by
// dragging the grip. Each list has its own handle class so dragging a nested
// row doesn't move its parent.
const fields = defineModel<BuilderField[]>({ required: true });
const { readonly } = useSchemaBuilder();

const handleClass = `schema-handle-${useId()}`;
const listElement = useTemplateRef<HTMLElement>("list");
const sortable = useSortable(listElement, fields, {
  handle: `.${handleClass}`,
  animation: 150,
  disabled: readonly.value,
});
watch(readonly, (value) => sortable.option("disabled", value));

function add() {
  fields.value.push(newBuilderField());
}
</script>

<template>
  <div class="space-y-2">
    <div ref="list" class="space-y-2">
      <SchemaField
        v-for="(field, index) in fields"
        :key="field.id"
        v-model="fields[index]!"
        :handle-class="handleClass"
        @remove="fields.splice(index, 1)"
      />
    </div>
    <p v-if="!fields.length" class="text-sm text-muted">No fields yet.</p>
    <UButton
      v-if="!readonly"
      icon="i-lucide-plus"
      size="sm"
      color="neutral"
      variant="outline"
      label="Add field"
      @click="add"
    />
  </div>
</template>
