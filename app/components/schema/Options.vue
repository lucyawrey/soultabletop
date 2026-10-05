<script setup lang="ts">
import { useSortable } from "@vueuse/integrations/useSortable";
import {
  newBuilderOption,
  optionsErrorId,
  type BuilderNode,
} from "#shared/schema-builder";

// A `string` or `number` field's `options`: when on, only the listed values
// are valid, and sheets show each one's label. Rows reorder by dragging.
const node = defineModel<BuilderNode>({ required: true });
const { errors, readonly } = useSchemaBuilder();

const handleClass = `schema-option-handle-${useId()}`;
const listElement = useTemplateRef<HTMLElement>("list");
const options = computed({
  get: () => node.value.options,
  set: (value) => {
    node.value.options = value;
  },
});
const sortable = useSortable(listElement, options, {
  handle: `.${handleClass}`,
  animation: 150,
  disabled: readonly.value,
});
watch(readonly, (value) => sortable.option("disabled", value));

// Turning options on for the first time starts with one empty row.
watch(
  () => node.value.hasOptions,
  (hasOptions) => {
    if (hasOptions && !node.value.options.length)
      node.value.options.push(newBuilderOption());
  },
);
</script>

<template>
  <div class="space-y-2">
    <UCheckbox
      v-model="node.hasOptions"
      label="Options"
      description="Limit the field to listed values; sheets show each value's label."
      :disabled="readonly"
    />
    <div v-if="node.hasOptions" class="space-y-2 ps-6">
      <div ref="list" class="space-y-2">
        <div
          v-for="(option, index) in node.options"
          :key="option.id"
          class="flex items-start gap-2"
        >
          <UIcon
            v-if="!readonly"
            name="i-lucide-grip-vertical"
            :class="[handleClass, 'mt-2 size-4 shrink-0 cursor-grab text-dimmed']"
            aria-hidden="true"
          />
          <UFormField
            size="md"
            :error="errors.get(option.id)"
            class="min-w-28 flex-1"
            :ui="{ error: 'text-xs' }"
          >
            <UInput
              v-model="option.value"
              :placeholder="node.type === 'number' ? 'Value (number)' : 'Value'"
              aria-label="Value"
              :inputmode="node.type === 'number' ? 'decimal' : undefined"
              class="w-full font-mono"
              :disabled="readonly"
            />
          </UFormField>
          <UInput
            v-model="option.label"
            :placeholder="option.value || 'Label'"
            aria-label="Label"
            class="min-w-28 flex-1"
            :disabled="readonly"
          />
          <UButton
            v-if="!readonly"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="md"
            aria-label="Remove option"
            @click="node.options.splice(index, 1)"
          />
        </div>
      </div>
      <p
        v-if="errors.get(optionsErrorId(node.id))"
        class="text-xs text-error"
      >
        {{ errors.get(optionsErrorId(node.id)) }}
      </p>
      <UButton
        v-if="!readonly"
        icon="i-lucide-plus"
        size="sm"
        color="neutral"
        variant="outline"
        label="Add option"
        @click="node.options.push(newBuilderOption())"
      />
    </div>
  </div>
</template>
