<script setup lang="ts">
import type { ResourceSource } from "#shared/resource-list";
import { extractApiErrorMessage } from "~/utils/api-error";
import type { TableColumn } from "@nuxt/ui";

// Logged-out visitors can view public items here; creating needs an account.
const loggedIn = await useLoggedIn();

interface SystemItem {
  id: string;
  source: ResourceSource;
  readableId: string;
  name: string;
  isPubliclyReadable: boolean;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  ownerGroupId: string | null;
  canChangeOwner: boolean;
}

const list = await useResourceList<SystemItem>("/api/system", loggedIn);
const { items: systems, status, refresh } = list;

const columns: TableColumn<SystemItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "source", header: "Source" },
  { accessorKey: "isPubliclyReadable", header: "Visibility" },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => formatShortDate(row.original.updatedAt),
  },
  { id: "actions" },
];

const isFormOpen = ref(false);
const editingSystem = ref<SystemItem | null>(null);
const form = reactive({
  readableId: "",
  name: "",
  isPubliclyReadable: false,
  ownerGroupId: null as string | null,
});
const formBusy = ref(false);
const formError = ref("");
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(form);
const idAvailability = useResourceIdAvailability(form, "system", () => editingSystem.value ?? undefined);

function openCreate() {
  editingSystem.value = null;
  formError.value = "";
  form.readableId = "";
  form.name = "";
  form.isPubliclyReadable = false;
  form.ownerGroupId = null;
  resetReadableIdTouched(false);
  isFormOpen.value = true;
}

function openEdit(item: SystemItem) {
  form.ownerGroupId = item.ownerGroupId;
  editingSystem.value = item;
  formError.value = "";
  form.readableId = item.readableId;
  form.name = item.name;
  form.isPubliclyReadable = item.isPubliclyReadable;
  resetReadableIdTouched(true);
  isFormOpen.value = true;
}

// Sends ownerGroupId only when the Owner field changed it.
function ownerChange(item: SystemItem) {
  return form.ownerGroupId !== item.ownerGroupId
    ? { ownerGroupId: form.ownerGroupId }
    : {};
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    if (editingSystem.value) {
      await $fetch(`/api/system/${editingSystem.value.id}`, {
        method: "PATCH",
        body: {
          readableId: form.readableId,
          name: form.name,
          isPubliclyReadable: form.isPubliclyReadable,
          ...ownerChange(editingSystem.value),
        },
      });
    } else {
      await $fetch("/api/system", {
        method: "POST",
        body: {
          readableId: form.readableId,
          name: form.name,
          isPubliclyReadable: form.isPubliclyReadable,
          ownerGroupId: form.ownerGroupId ?? undefined,
        },
      });
    }

    isFormOpen.value = false;
    await Promise.all([refresh(), refreshSystems()]);
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not save system.");
  } finally {
    formBusy.value = false;
  }
}

const isDeleteOpen = ref(false);
const deletingSystem = ref<SystemItem | null>(null);
const deleteBusy = ref(false);
const deleteError = ref("");

function confirmDelete(item: SystemItem) {
  deleteError.value = "";
  deletingSystem.value = item;
  isDeleteOpen.value = true;
}

async function remove() {
  if (!deletingSystem.value) return;
  deleteBusy.value = true;
  deleteError.value = "";

  try {
    await $fetch(`/api/system/${deletingSystem.value.id}`, {
      method: "DELETE",
    });
    isDeleteOpen.value = false;
    await Promise.all([refresh(), refreshSystems()]);
  } catch (error) {
    deleteError.value = extractApiErrorMessage(
      error,
      "Could not delete system.",
    );
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <PageHeader eyebrow="Build" title="Systems">
      <UButton v-if="loggedIn" icon="i-lucide-plus" @click="openCreate">
        New System
      </UButton>
    </PageHeader>

    <ResourceList
      :list="list"
      noun="Systems"
      view-key="systems"
      default-view="table"
    >
<UTable
      :data="systems"
      :columns="columns"
      :loading="status === 'pending'"
    >
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/systems/${row.original.id}`"
          class="font-bold text-highlighted hover:text-primary hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
        <span class="mt-0.5 block font-mono text-xs text-muted">
          {{ row.original.readableId }}
        </span>
      </template>

      <template #source-cell="{ row }">
        <SourceBadge :source="row.original.source" />
      </template>

      <template #isPubliclyReadable-cell="{ row }">
        <VisibilityBadge
          :is-publicly-readable="row.original.isPubliclyReadable"
        />
      </template>

      <template #actions-cell="{ row }">
        <ResourceActionsMenu
          :can-edit="row.original.canEdit"
          :view-to="`/systems/${row.original.id}`"
          :name="row.original.name" @edit="openEdit(row.original)"
          @delete="confirmDelete(row.original)"
        />
      </template>

      <template #empty>
        <ResourceListEmpty :list="list" plural="systems" create-label="New System" @create="openCreate()" />
      </template>
    </UTable>
          <template #cards>
        <ResourceCards :items="systems" :to="(item) => `/systems/${item.id}`">
          <template #actions="{ item }">
            <ResourceActionsMenu
              :can-edit="item.canEdit"
              :view-to="`/systems/${item.id}`"
              :name="item.name" @edit="openEdit(item)"
              @delete="confirmDelete(item)"
            />
          </template>
          <template #empty>
            <ResourceListEmpty :list="list" plural="systems" create-label="New System" @create="openCreate()" />
          </template>
        </ResourceCards>
      </template>
    </ResourceList>

    <UModal
      v-model:open="isFormOpen"
      :title="editingSystem ? 'Edit System' : 'New System'"
    >
      <template #body>
        <UForm
          id="system-form"
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
          <VisibilityField v-model="form.isPubliclyReadable" />
          <OwnerField
            v-if="!editingSystem || editingSystem.canChangeOwner"
            v-model="form.ownerGroupId"
            :original="editingSystem ? editingSystem.ownerGroupId : undefined"
          />
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
          form="system-form"
          label="Save"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete System"
      :description="`Are you sure you want to delete &quot;${deletingSystem?.name}&quot;? This action cannot be undone.`"
      :ui="{ footer: 'justify-end' }"
    >
      <template v-if="deleteError" #body>
        <UAlert color="error" variant="subtle" :description="deleteError" />
      </template>

      <template #footer="{ close }">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="close"
        />
        <UButton
          label="Delete"
          color="error"
          :loading="deleteBusy"
          @click="remove"
        />
      </template>
    </UModal>
  </PageContainer>
</template>
