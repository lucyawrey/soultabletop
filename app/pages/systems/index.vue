<script setup lang="ts">
import { extractApiErrorMessage } from "~/utils/api-error";
import type { TableColumn } from "@nuxt/ui";

definePageMeta({ middleware: "auth" });

interface SystemItem {
  id: string;
  slug: string;
  name: string;
  isPubliclyReadable: boolean;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  ownerGroupId: string | null;
  canChangeOwner: boolean;
}

const {
  data: systems,
  status,
  refresh,
} = await useLazyFetch<SystemItem[]>("/api/system", { default: () => [] });

const columns: TableColumn<SystemItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "slug", header: "Slug" },
  { accessorKey: "isPubliclyReadable", header: "Visibility" },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
  },
  { id: "actions" },
];

const isFormOpen = ref(false);
const editingSystem = ref<SystemItem | null>(null);
const form = reactive({
  slug: "",
  name: "",
  isPubliclyReadable: false,
  ownerGroupId: null as string | null,
});
const formBusy = ref(false);
const formError = ref("");
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);

function openCreate() {
  editingSystem.value = null;
  formError.value = "";
  form.slug = "";
  form.name = "";
  form.isPubliclyReadable = false;
  form.ownerGroupId = null;
  resetSlugTouched(false);
  isFormOpen.value = true;
}

function openEdit(item: SystemItem) {
  form.ownerGroupId = item.ownerGroupId;
  editingSystem.value = item;
  formError.value = "";
  form.slug = item.slug;
  form.name = item.name;
  form.isPubliclyReadable = item.isPubliclyReadable;
  resetSlugTouched(true);
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
          slug: form.slug,
          name: form.name,
          isPubliclyReadable: form.isPubliclyReadable,
          ...ownerChange(editingSystem.value),
        },
      });
    } else {
      await $fetch("/api/system", {
        method: "POST",
        body: {
          slug: form.slug,
          name: form.name,
          isPubliclyReadable: form.isPubliclyReadable,
          ownerGroupId: form.ownerGroupId ?? undefined,
        },
      });
    }

    isFormOpen.value = false;
    await refresh();
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
    await refresh();
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
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-highlighted">Systems</h1>
      <UButton icon="i-lucide-plus" size="sm" @click="openCreate">
        New System
      </UButton>
    </div>

    <UTable
      :data="systems"
      :columns="columns"
      :loading="status === 'pending'"
    >
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/systems/${row.original.id}`"
          class="font-medium text-highlighted hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
      </template>

      <template #isPubliclyReadable-cell="{ row }">
        <VisibilityBadge
          :is-publicly-readable="row.original.isPubliclyReadable"
        />
      </template>

      <template #actions-cell="{ row }">
        <UDropdownMenu
          v-if="row.original.canEdit"
          :items="[
            [
              {
                label: 'Edit',
                icon: 'i-lucide-pencil',
                onSelect: () => openEdit(row.original),
              },
            ],
            [
              {
                label: 'Delete',
                icon: 'i-lucide-trash',
                color: 'error',
                onSelect: () => confirmDelete(row.original),
              },
            ],
          ]"
        >
          <UButton
            icon="i-lucide-ellipsis"
            color="neutral"
            variant="ghost"
            size="sm"
          />
        </UDropdownMenu>
      </template>

      <template #empty>
        <p class="py-6 text-center text-sm text-muted">No systems yet.</p>
      </template>
    </UTable>

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
          <SlugField
            :model-value="form.slug"
            :error="slugError"
            @update:model-value="onSlugInput"
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
  </div>
</template>
