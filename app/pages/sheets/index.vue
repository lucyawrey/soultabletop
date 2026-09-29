<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import {
  extractApiErrorMessage,
  extractDefaultReplacement,
} from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

interface SheetItem {
  id: string;
  slug: string;
  name: string;
  updatedAt: string;
  contentTypeId: string;
  markup: string;
  cssStyles: string;
  isDefault: boolean;
  canEdit: boolean;
  isPubliclyReadable: boolean;
}

interface ContentTypeItem {
  id: string;
  name: string;
  canEdit: boolean;
}

const {
  data: sheets,
  status,
  refresh,
} = await useLazyFetch<SheetItem[]>("/api/sheet", { default: () => [] });

const { data: contentTypes } = await useLazyFetch<ContentTypeItem[]>(
  "/api/content-type",
  { default: () => [] },
);

const contentTypeOptions = computed(() =>
  contentTypes.value.map((item) => ({ label: item.name, value: item.id })),
);

function contentTypeName(contentTypeId: string) {
  return (
    contentTypes.value.find((item) => item.id === contentTypeId)?.name ??
    "Unknown"
  );
}

const columns: TableColumn<SheetItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "slug", header: "Slug" },
  { accessorKey: "isPubliclyReadable", header: "Visibility" },
  { accessorKey: "contentTypeId", header: "Content Type" },
  { accessorKey: "isDefault", header: "Default" },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
  },
  { id: "actions" },
];

const isFormOpen = ref(false);
const form = reactive({
  slug: "",
  name: "",
  isPubliclyReadable: false,
  ownerGroupId: null as string | null,
  contentTypeId: "",
  isDefault: false,
});
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);

// Only editors of the ContentType may change its default Sheet (enforced
// server-side too), so the switch is hidden for everyone else.
const canSetDefault = computed(
  () =>
    contentTypes.value.find((item) => item.id === form.contentTypeId)
      ?.canEdit ?? false,
);
watch(canSetDefault, (allowed) => {
  if (!allowed) form.isDefault = false;
});

const formBusy = ref(false);
const formError = ref("");
// Set when creating this Sheet as the default would replace another default.
const replaceDefault = ref<string>();
watch(
  () => [form.contentTypeId, form.isDefault],
  () => (replaceDefault.value = undefined),
);

function openCreate(contentTypeId?: string) {
  const selectedType =
    contentTypes.value.find((item) => item.id === contentTypeId) ??
    contentTypes.value[0];
  if (!selectedType) return;

  formError.value = "";
  replaceDefault.value = undefined;
  form.slug = "";
  form.name = "";
  form.isPubliclyReadable = false;
  form.ownerGroupId = null;
  form.contentTypeId = selectedType.id;
  form.isDefault = false;
  resetSlugTouched(false);
  isFormOpen.value = true;
}

// `/sheets?contentTypeId=…` (from a Content Type's detail page) opens the
// create form with that type preselected, then drops the query.
const route = useRoute();
watch(
  contentTypes,
  (items) => {
    const contentTypeId = route.query.contentTypeId;
    if (typeof contentTypeId !== "string" || items.length === 0) return;
    openCreate(contentTypeId);
    navigateTo({ query: {} }, { replace: true });
  },
  { immediate: true },
);

async function submitForm(confirmReplaceDefault = false) {
  formBusy.value = true;
  formError.value = "";
  replaceDefault.value = undefined;

  try {
    // New Sheets start from markup generated from the schema; continue in
    // the editor.
    const created = await $fetch<{ id: string }>("/api/sheet", {
      method: "POST",
      body: {
        slug: form.slug,
        name: form.name,
        isPubliclyReadable: form.isPubliclyReadable,
        contentTypeId: form.contentTypeId,
        ownerGroupId: form.ownerGroupId ?? undefined,
        ...(canSetDefault.value ? { isDefault: form.isDefault } : {}),
        ...(confirmReplaceDefault ? { confirmReplaceDefault: true } : {}),
      },
    });
    isFormOpen.value = false;
    await navigateTo(`/sheets/${created.id}/edit`);
  } catch (error) {
    replaceDefault.value = extractDefaultReplacement(error);
    if (!replaceDefault.value)
      formError.value = extractApiErrorMessage(error, "Could not save sheet.");
  } finally {
    formBusy.value = false;
  }
}

const isDeleteOpen = ref(false);
const deletingSheet = ref<SheetItem | null>(null);
const deleteBusy = ref(false);
const deleteError = ref("");

function confirmDelete(item: SheetItem) {
  deletingSheet.value = item;
  deleteError.value = "";
  isDeleteOpen.value = true;
}

async function remove() {
  if (!deletingSheet.value) return;
  deleteBusy.value = true;
  deleteError.value = "";

  try {
    await $fetch(`/api/sheet/${deletingSheet.value.id}`, {
      method: "DELETE",
    });
    isDeleteOpen.value = false;
    await refresh();
  } catch (error) {
    deleteError.value = extractApiErrorMessage(
      error,
      "Could not delete sheet.",
    );
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-highlighted">Sheets</h1>
      <UButton
        icon="i-lucide-plus"
        size="sm"
        :disabled="contentTypes.length === 0"
        @click="openCreate()"
      >
        New Sheet
      </UButton>
    </div>

    <p v-if="contentTypes.length === 0" class="text-sm text-muted">
      Create a content type before adding sheets.
    </p>

    <UTable :data="sheets" :columns="columns" :loading="status === 'pending'">
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/sheets/${row.original.id}`"
          class="font-medium text-highlighted hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
      </template>

      <template #contentTypeId-cell="{ row }">
        {{ contentTypeName(row.original.contentTypeId) }}
      </template>

      <template #isDefault-cell="{ row }">
        <UBadge v-if="row.original.isDefault" variant="subtle">
          Default
        </UBadge>
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
                to: `/sheets/${row.original.id}/edit`,
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
        <p class="py-6 text-center text-sm text-muted">No sheets yet.</p>
      </template>
    </UTable>

    <UModal
      v-model:open="isFormOpen"
      title="New Sheet"
      description="It starts with markup generated from the content type's schema; you'll customize it in the editor next."
    >
      <template #body>
        <UForm
          id="sheet-form"
          :state="form"
          class="space-y-4"
          @submit="submitForm()"
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
          <VisibilityField v-model="form.isPubliclyReadable" />
          <OwnerField v-model="form.ownerGroupId" />
          <UFormField
            name="contentTypeId"
            label="Content Type"
            description="Can't be changed after creation."
            required
          >
            <USelect
              v-model="form.contentTypeId"
              :items="contentTypeOptions"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="canSetDefault"
            name="isDefault"
            label="Default sheet"
            description="Used for content of this type that doesn't pick a sheet. You'll be asked before it replaces another default."
          >
            <USwitch v-model="form.isDefault" />
          </UFormField>
          <ReplaceDefaultSheetAlert
            v-if="replaceDefault"
            :message="replaceDefault"
            :loading="formBusy"
            @confirm="submitForm(true)"
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
          form="sheet-form"
          label="Create and edit"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete Sheet"
      :description="`Are you sure you want to delete &quot;${deletingSheet?.name}&quot;? This action cannot be undone.`"
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
