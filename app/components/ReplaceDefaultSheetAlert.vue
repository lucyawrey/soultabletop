<script setup lang="ts">
// Shown when saving a Sheet as the default would replace its ContentType's
// current default Sheet; the parent resends the save with
// `confirmReplaceDefault: true` on confirm.
defineProps<{ message: string; loading?: boolean }>();
const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-lucide-triangle-alert"
    title="Replace the default Sheet?"
    :description="`${message}.`"
    :actions="[
      {
        label: 'Replace default',
        color: 'warning',
        loading,
        onClick: () => emit('confirm'),
      },
    ]"
  />
</template>
