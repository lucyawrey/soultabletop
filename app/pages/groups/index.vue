<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { extractApiErrorMessage } from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

type GroupRole = "admin" | "editor" | "member";

interface GroupItem {
  id: string;
  readableId: string;
  name: string;
  kind: "user" | "system";
  // null for a system group a site admin isn't in.
  role: GroupRole | null;
  memberCount: number;
}

const {
  data: groups,
  status,
  refresh,
} = await useLazyFetch<GroupItem[]>("/api/group", { default: () => [] });

const columns: TableColumn<GroupItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "role", header: "Your Role" },
  { accessorKey: "memberCount", header: "Members" },
];

// A user's groups are few, so the search filters them in the browser.
const search = ref("");
const visibleGroups = computed(() => {
  const text = search.value.trim().toLowerCase();
  return text
    ? groups.value.filter(
        (item) =>
          item.name.toLowerCase().includes(text) ||
          item.readableId.toLowerCase().includes(text),
      )
    : groups.value;
});

const isFormOpen = ref(false);
const form = reactive({ readableId: "", name: "", official: false });

// Only site admins can create official (system) groups.
const { data: profile } = await useLazyFetch<{ role: "member" | "admin" }>(
  "/api/profile",
);
const isSiteAdmin = computed(() => profile.value?.role === "admin");
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(form);
const idAvailability = useResourceIdAvailability(form, "group");
const formBusy = ref(false);
const formError = ref("");

function openCreate() {
  formError.value = "";
  form.readableId = "";
  form.name = "";
  form.official = false;
  resetReadableIdTouched(false);
  isFormOpen.value = true;
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    await $fetch("/api/group", {
      method: "POST",
      body: {
        readableId: form.readableId,
        name: form.name,
        ...(form.official ? { official: true } : {}),
      },
    });
    isFormOpen.value = false;
    await Promise.all([refresh(), refreshSystems()]);
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not create group.");
  } finally {
    formBusy.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-highlighted">Groups</h1>
      <UButton icon="i-lucide-plus" size="sm" @click="openCreate">
        New Group
      </UButton>
    </div>

    <UInput
      v-model="search"
      icon="i-lucide-search"
      placeholder="Search groups by name or ID"
      class="w-full max-w-md"
    />

    <UTable :data="visibleGroups" :columns="columns" :loading="status === 'pending'">
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/groups/${row.original.id}`"
          class="font-medium text-highlighted hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
        <UBadge
          v-if="row.original.kind === 'system'"
          variant="subtle"
          size="sm"
          class="ms-2"
        >
          Official
        </UBadge>
      </template>

      <template #role-cell="{ row }">
        <span v-if="!row.original.role" class="text-sm text-muted">
          Site admin
        </span>
        <UBadge
          v-else
          :color="row.original.role === 'admin' ? 'primary' : 'neutral'"
          variant="subtle"
          class="capitalize"
        >
          {{ row.original.role }}
        </UBadge>
      </template>

      <template #empty>
        <TableSkeleton v-if="isLoading(status)" />
        <p v-else class="py-6 text-center text-sm text-muted">
          {{ search.trim() ? "No groups match your search." : "You aren't in any groups yet." }}
        </p>
      </template>
    </UTable>

    <UModal v-model:open="isFormOpen" title="New Group">
      <template #body>
        <UForm
          id="group-form"
          :state="form"
          class="space-y-4"
          @submit="submitForm"
        >
          <UFormField name="name" label="Name" required>
            <UInput v-model="form.name" class="w-full" required />
          </UFormField>
          <ReadableIdField
            :model-value="form.readableId"
            :availability="idAvailability"
            :error="readableIdError"
            @update:model-value="onReadableIdInput"
          />
          <UFormField
            v-if="isSiteAdmin"
            name="official"
            label="Official group"
            description="Resources it owns are official. Site admins can manage it."
          >
            <USwitch v-model="form.official" />
          </UFormField>
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            :description="formError"
          />
        </UForm>
      </template>

      <template #footer="{ close }">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="close"
        />
        <UButton
          type="submit"
          form="group-form"
          label="Create"
          :loading="formBusy"
        />
      </template>
    </UModal>
  </PageContainer>
</template>
