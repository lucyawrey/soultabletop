<script setup lang="ts">
// Form field for a Resource's or Group's readable ID, labeled "ID". Pages pass `onReadableIdInput` from
// `useReadableIdFromName` as the update handler, so it isn't a plain v-model.
// `label` and `description` are overridable for IDs that aren't a Resource's or Group's (e.g. usernames).
withDefaults(
  defineProps<{
    modelValue: string;
    error?: string;
    name?: string;
    label?: string;
    description?: string;
  }>(),
  {
    name: "readableId",
    label: "ID",
    description:
      "Lowercase letters, numbers, and hyphens. Auto-generated from the name — edit it if you need something different or unique.",
  },
);
defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <UFormField
    :name="name"
    :label="label"
    :description="description"
    :error="error"
    required
  >
    <UInput
      :model-value="modelValue"
      class="w-full"
      required
      @update:model-value="$emit('update:modelValue', String($event))"
    />
  </UFormField>
</template>
