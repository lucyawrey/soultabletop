<script setup lang="ts">
// Form field choosing who owns a resource: the user (`null`), or a group
// where they're an admin or editor (the server checks the same). Hidden when
// there's nothing to choose. When editing, pass `original` (the current
// ownerGroupId); moving to a group then shows a warning, and the parent sends
// `ownerGroupId` only if it changed.
const owner = defineModel<string | null>({ required: true });
const props = defineProps<{ original?: string | null }>();

interface GroupItem {
  id: string;
  name: string;
  kind: "user" | "system";
  // null: a system group the user (a site admin) isn't in.
  role: "admin" | "editor" | "member" | null;
}

const { data: groups } = useLazyFetch<GroupItem[]>("/api/group", {
  key: "owner-field-groups",
  default: () => [],
});

const editing = computed(() => props.original !== undefined);

// Select items can't have an empty value, so "you" is a sentinel.
const YOU = "you";
const options = computed(() => {
  const items = [
    { label: "You", value: YOU },
    ...groups.value
      .filter(
        (item) =>
          item.role === "admin" ||
          item.role === "editor" ||
          (item.kind === "system" && item.role === null),
      )
      .map((item) => ({ label: item.name, value: item.id })),
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
      description="Its admins and editors will be able to edit and delete it, and only its admins can change the owner again."
    />
  </UFormField>
</template>
