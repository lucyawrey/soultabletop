<script setup lang="ts">
// Form field for a Resource's or Group's readable ID, labeled "ID". Pages pass `onReadableIdInput` from
// `useReadableIdFromName` as the update handler, so it isn't a plain v-model.
// `label` and `description` are overridable for IDs that aren't a Resource's or Group's (e.g. usernames).
// `availability` (from `useResourceIdAvailability`) adds the live "available" /
// "in use" hint; `subject` is what it calls the value.
import type { AvailabilityStatus } from "~/composables/useReadableIdAvailability";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    error?: string;
    availability?: AvailabilityStatus;
    subject?: string;
    name?: string;
    label?: string;
    description?: string;
  }>(),
  {
    name: "readableId",
    label: "ID",
    subject: "ID",
    description:
      "Lowercase letters, numbers, and hyphens. Auto-generated from the name — edit it if you need something different or unique.",
  },
);
defineEmits<{ "update:modelValue": [value: string] }>();

const shownError = computed(
  () =>
    props.error ??
    (props.availability === "taken"
      ? `That ${props.subject} is already in use.`
      : undefined),
);
const hint = computed(() => {
  if (props.availability === "checking") return "Checking availability…";
  if (props.availability === "available")
    return `That ${props.subject} is available.`;
  if (props.availability === "failed") return "Could not check availability.";
  return undefined;
});
</script>

<template>
  <UFormField
    :name="name"
    :label="label"
    :description="description"
    :error="shownError"
    required
  >
    <template v-if="hint" #help>
      <span :class="availability === 'available' ? 'text-success' : 'text-muted'">
        {{ hint }}
      </span>
    </template>
    <UInput
      :model-value="modelValue"
      class="w-full"
      :ui="{ base: 'font-mono' }"
      required
      autocomplete="off"
      autocapitalize="none"
      :spellcheck="false"
      data-1p-ignore
      @update:model-value="$emit('update:modelValue', String($event))"
    />
  </UFormField>
</template>
