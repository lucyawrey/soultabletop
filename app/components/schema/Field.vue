<script setup lang="ts">
import {
  BUILDER_FIELD_TYPES,
  type BuilderField,
} from "#shared/schema-builder";

// One field row: drag handle, key, type, required, and a toggle for the
// label, description, and type settings (entries of a `struct`, itemType of
// an `array`).
const field = defineModel<BuilderField>({ required: true });
defineProps<{ handleClass: string }>();
const emit = defineEmits<{ remove: [] }>();
const { errors, readonly } = useSchemaBuilder();

const typeOptions = BUILDER_FIELD_TYPES.map((type) => ({
  label: type,
  value: type,
}));

const error = computed(() => errors.value.get(field.value.id));
// `struct` and `array` fields start open, since their settings are their
// contents.
const open = ref(field.value.type === "struct" || field.value.type === "array");
</script>

<template>
  <div class="rounded-md border border-default bg-default">
    <div class="flex flex-wrap items-start gap-2 p-2">
      <UIcon
        v-if="!readonly"
        name="i-lucide-grip-vertical"
        :class="[handleClass, 'mt-2 size-4 shrink-0 cursor-grab text-dimmed']"
        aria-hidden="true"
      />
      <UFormField
        :error="error"
        class="min-w-40 flex-1"
        :ui="{ error: 'text-xs' }"
      >
        <UInput
          v-model="field.key"
          placeholder="key"
          aria-label="key"
          class="w-full font-mono"
          :disabled="readonly"
        />
      </UFormField>
      <USelect
        v-model="field.type"
        :items="typeOptions"
        aria-label="type"
        class="w-40"
        :disabled="readonly"
      />
      <UCheckbox
        v-model="field.required"
        label="required"
        class="mt-1.5"
        :disabled="readonly"
      />
      <div class="ms-auto flex gap-1">
        <UButton
          :icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="open ? 'Hide settings' : 'Show settings'"
          :aria-expanded="open"
          @click="open = !open"
        />
        <UButton
          v-if="!readonly"
          icon="i-lucide-trash"
          color="error"
          variant="ghost"
          size="sm"
          aria-label="Remove field"
          @click="emit('remove')"
        />
      </div>
    </div>
    <div v-if="open" class="space-y-3 border-t border-default p-3 ps-8">
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="label" hint="Optional">
          <UInput
            v-model="field.label"
            class="w-full"
            :disabled="readonly"
          />
        </UFormField>
        <UFormField label="description" hint="Optional">
          <UInput
            v-model="field.description"
            class="w-full"
            :disabled="readonly"
          />
        </UFormField>
      </div>
      <SchemaNodeSettings v-model="field" />
    </div>
  </div>
</template>
