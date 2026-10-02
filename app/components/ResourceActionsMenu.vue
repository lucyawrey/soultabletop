<script setup lang="ts">
// The Edit / Delete menu on a list row or card. Shown only when the viewer can
// edit; delete always keeps its label and icon. Edit is a link when `editTo`
// is given (pages that edit on their own page), else it emits `edit`.
const props = defineProps<{ canEdit: boolean; name: string; editTo?: string }>();
const emit = defineEmits<{ edit: []; delete: [] }>();

const items = computed(() => [
  [
    props.editTo
      ? { label: "Edit", icon: "i-lucide-pencil", to: props.editTo }
      : { label: "Edit", icon: "i-lucide-pencil", onSelect: () => emit("edit") },
  ],
  [
    {
      label: "Delete",
      icon: "i-lucide-trash",
      color: "error" as const,
      onSelect: () => emit("delete"),
    },
  ],
]);
</script>

<template>
  <UDropdownMenu v-if="props.canEdit" :items="items">
    <UButton
      icon="i-lucide-ellipsis"
      color="neutral"
      variant="ghost"
      size="sm"
      :aria-label="`Actions for ${name}`"
    />
  </UDropdownMenu>
</template>
