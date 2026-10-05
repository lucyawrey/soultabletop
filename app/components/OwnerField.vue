<script setup lang="ts">
// Form field choosing who owns a resource: the user (`null`), or a group
// where they're an admin or editor (the server checks the same). Hidden when
// there's nothing to choose. When editing, pass `original` (the current
// ownerGroupId); moving to a group then shows a warning, and the parent sends
// `ownerGroupId` only if it changed.
const owner = defineModel<string | null>({ required: true });
const props = defineProps<{ original?: string | null }>();

const { groups } = useOwnerGroups();
const editing = computed(() => props.original !== undefined);

// Create dialogs start on the group the user is working as (from the user
// menu), once per dialog, so switching back to You sticks.
const { group: workingAs } = useWorkingAs();
if (!editing.value) {
  let prefilled = false;
  watch(
    workingAs,
    (item) => {
      if (prefilled || !item) return;
      prefilled = true;
      if (owner.value === null) owner.value = item.id;
    },
    { immediate: true },
  );
}

// Select items can't have an empty value, so "you" is a sentinel.
const YOU = "you";
const options = computed(() => {
  const items = [
    { label: "You", value: YOU },
    ...groups.value.map((item) => ({ label: item.name, value: item.id })),
  ];
  // The current owning group, if the user can't pick it themselves (e.g. a
  // site admin outside it).
  if (props.original && !items.some((item) => item.value === props.original))
    items.push({ label: "Current group", value: props.original });
  return items;
});
const selected = computed({
  get: () => owner.value ?? YOU,
  set: (value: string) => {
    owner.value = value === YOU ? null : value;
  },
});

const movingToGroup = computed(
  () => editing.value && !!owner.value && owner.value !== props.original,
);
const targetName = computed(
  () =>
    options.value.find((item) => item.value === owner.value)?.label ??
    "The group",
);
</script>

<template>
  <UFormField
    v-if="options.length > 1"
    name="ownerGroupId"
    label="Owner"
    description="Group-owned resources can be edited by the group's admins and editors."
  >
    <USelect v-model="selected" :items="options" class="w-full" />
    <UAlert
      v-if="movingToGroup"
      class="mt-2"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`${targetName} will own this`"
      description="Its admins and editors will be able to edit it, and only its admins can delete it or change the owner again."
    />
  </UFormField>
</template>
