<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

// The View / Edit / Delete menu on a list row or card. Every item has it: View
// opens the resource's page, and Edit and Delete appear only when the viewer
// can edit. Delete also follows `canDelete` when given (a campaign's GMs can
// edit it but not delete it). Delete keeps its label and icon. Edit is a link
// when `editTo` is given (pages that edit on their own page), else it emits
// `edit`.
const props = defineProps<{
  canEdit: boolean;
  canDelete?: boolean;
  name: string;
  viewTo: string;
  editTo?: string;
}>();
const emit = defineEmits<{ edit: []; delete: [] }>();

const items = computed(() => {
  // View and Edit in one group; Delete set apart below a divider.
  const actions: DropdownMenuItem[] = [
    { label: "View", icon: "i-lucide-eye", to: props.viewTo },
  ];
  if (!props.canEdit) return [actions];
  actions.push(
    props.editTo
      ? { label: "Edit", icon: "i-lucide-pencil", to: props.editTo }
      : { label: "Edit", icon: "i-lucide-pencil", onSelect: () => emit("edit") },
  );
  if (props.canDelete === false) return [actions];
  return [
    actions,
    [
      {
        label: "Delete",
        icon: "i-lucide-trash",
        color: "error" as const,
        onSelect: () => emit("delete"),
      },
    ],
  ];
});
</script>

<template>
  <UDropdownMenu :items="items">
    <UButton
      icon="i-lucide-ellipsis"
      color="neutral"
      variant="ghost"
      size="sm"
      :aria-label="`Actions for ${name}`"
    />
  </UDropdownMenu>
</template>
