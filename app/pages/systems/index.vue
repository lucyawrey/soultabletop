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
}

const {
  data: systems,
  status,
  refresh,
} = await useLazyFetch<SystemItem[]>("/api/system", { default: () => [] });

const columns: TableColumn<SystemItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "slug", header: "Slug" },
  { accessorKey: "isPubliclyReadable", header: "Public" },
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
  resetSlugTouched(false);
  isFormOpen.value = true;
}

function openEdit(item: SystemItem) {
  editingSystem.value = item;
  formError.value = "";
  form.slug = item.slug;
  form.name = item.name;
  form.isPubliclyReadable = item.isPubliclyReadable;
  resetSlugTouched(true);
  isFormOpen.value = true;
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
        },
      });
    } else {
      await $fetch("/api/system", {
        method: "POST",
        body: {
          slug: form.slug,
          name: form.name,
          isPubliclyReadable: form.isPubliclyReadable,
        },
      });
    }

    isFormOpen.value = false;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not save System.");
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
      "Could not delete System.",
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
        <UBadge
          :color="row.original.isPubliclyReadable ? 'primary' : 'neutral'"
          variant="subtle"
        >
          {{ row.original.isPubliclyReadable ? "Public" : "Private" }}
        </UBadge>
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
        <p class="py-6 text-center text-sm text-muted">No Systems yet.</p>
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
          <UFormField
            name="slug"
            label="Slug"
            description="Auto-generated from the name — edit if you need something different or unique."
            :error="slugError"
            required
          >
            <UInput
              :model-value="form.slug"
              class="w-full"
              required
              @update:model-value="onSlugInput"
            />
          </UFormField>
          <UFormField name="isPubliclyReadable" label="Publicly readable">
            <USwitch v-model="form.isPubliclyReadable" />
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
