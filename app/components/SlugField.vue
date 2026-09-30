<script setup lang="ts">
// Form field for a Resource's or Group's slug. Pages pass `onSlugInput` from
// `useSlugFromName` as the update handler, so it isn't a plain v-model.
defineProps<{ modelValue: string; error?: string }>();
defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <UFormField
    name="slug"
    label="Slug"
    description="A short, readable ID: lowercase letters, numbers, and hyphens. Auto-generated from the name — edit it if you need something different or unique."
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
