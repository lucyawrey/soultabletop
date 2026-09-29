<script setup lang="ts">
// Form field choosing who owns a new resource: the user, or a group where
// they're an admin or editor (the server checks the same). `null` means the
// user. Hidden when the user has no such group.
const owner = defineModel<string | null>({ required: true });

interface GroupItem {
  id: string;
  name: string;
  role: "admin" | "editor" | "member";
}

const { data: groups } = useLazyFetch<GroupItem[]>("/api/group", {
  key: "owner-field-groups",
  default: () => [],
});

// Select items can't have an empty value, so "you" is a sentinel.
const YOU = "you";
const options = computed(() => [
  { label: "You", value: YOU },
  ...groups.value
    .filter((item) => item.role === "admin" || item.role === "editor")
    .map((item) => ({ label: item.name, value: item.id })),
]);
const selected = computed({
  get: () => owner.value ?? YOU,
  set: (value: string) => {
    owner.value = value === YOU ? null : value;
  },
});
</script>

<template>
  <UFormField
    v-if="options.length > 1"
    name="ownerGroupId"
    label="Owner"
    description="Group-owned resources can be edited by the group's admins and editors."
  >
    <USelect v-model="selected" :items="options" class="w-full" />
  </UFormField>
</template>
