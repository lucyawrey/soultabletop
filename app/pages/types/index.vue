<script setup lang="ts">
import type { ResourceSource } from "#shared/resource-list";
import type { TableColumn } from "@nuxt/ui";
import {
  extractApiErrorMessage,
  extractBrokenSheets,
  type BrokenSheets,
} from "~/utils/api-error";
import {
  CONTENT_CATEGORY_LABELS,
  type ContentCategory,
} from "#shared/content-categories";

// Logged-out visitors can view public items here; creating needs an account.
const loggedIn = await useLoggedIn();

interface ContentTypeItem {
  id: string;
  source: ResourceSource;
  readableId: string;
  name: string;
  systemId: string;
  contentCategory: ContentCategory;
  hasStrictSchema: boolean;
  schema: Record<string, unknown>;
  canEdit: boolean;
  ownerGroupId: string | null;
  canChangeOwner: boolean;
  isPubliclyReadable: boolean;
}

interface SystemItem {
  id: string;
  name: string;
}

const categoryOptions = Object.entries(CONTENT_CATEGORY_LABELS).map(
  ([value, label]) => ({ label, value }),
);

const { systemId: currentSystemId } = useCurrentSystem();
const list = await useResourceList<ContentTypeItem>("/api/content-type", loggedIn, { bySystem: true });
const { items: contentTypes, status, refresh } = list;

const { data: systems, status: systemsStatus } = await useLazyFetch<SystemItem[]>("/api/system", {
  default: () => [],
});

const systemOptions = computed(() =>
  systems.value.map((item) => ({ label: item.name, value: item.id })),
);

function systemName(systemId: string) {
  return systems.value.find((item) => item.id === systemId)?.name ?? "Unknown";
}

const columns: TableColumn<ContentTypeItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "source", header: "Source" },
  { accessorKey: "readableId", header: "ID" },
  { accessorKey: "isPubliclyReadable", header: "Visibility" },
  { accessorKey: "systemId", header: "System" },
  { accessorKey: "contentCategory", header: "Category" },
  { accessorKey: "hasStrictSchema", header: "Strict Schema" },
  { id: "actions" },
];

const isFormOpen = ref(false);
const editingType = ref<ContentTypeItem | null>(null);
const form = reactive({
  readableId: "",
  name: "",
  isPubliclyReadable: false,
  ownerGroupId: null as string | null,
  systemId: "",
  contentCategory: "general" as ContentCategory,
  hasStrictSchema: false,
});
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(form);
const formBusy = ref(false);
const formError = ref("");
const brokenSheets = ref<BrokenSheets>();

function openCreate(systemId?: string) {
  const system =
    systems.value.find((item) => item.id === systemId) ??
    systems.value.find((item) => item.id === currentSystemId.value) ?? systems.value[0];
  if (!system) return;

  editingType.value = null;
  formError.value = "";
  brokenSheets.value = undefined;
  form.readableId = "";
  form.name = "";
  form.isPubliclyReadable = false;
  form.ownerGroupId = null;
  form.systemId = system.id;
  form.contentCategory = "general";
  form.hasStrictSchema = false;
  resetReadableIdTouched(false);
  isFormOpen.value = true;
}

function openEdit(item: ContentTypeItem) {
  form.ownerGroupId = item.ownerGroupId;
  editingType.value = item;
  formError.value = "";
  brokenSheets.value = undefined;
  form.readableId = item.readableId;
  form.name = item.name;
  form.isPubliclyReadable = item.isPubliclyReadable;
  form.systemId = item.systemId;
  form.contentCategory = item.contentCategory;
  form.hasStrictSchema = item.hasStrictSchema;
  resetReadableIdTouched(true);
  isFormOpen.value = true;
}

// `/types?systemId=…` (from a System's detail page) opens the create form with
// that System preselected, then drops the query so a refresh doesn't reopen it.
const route = useRoute();
watch(
  systems,
  (items) => {
    const systemId = route.query.systemId;
    if (!loggedIn.value || typeof systemId !== "string" || items.length === 0)
      return;
    openCreate(systemId);
    navigateTo({ query: {} }, { replace: true });
  },
  { immediate: true },
);

// Sends ownerGroupId only when the Owner field changed it.
function ownerChange(item: ContentTypeItem) {
  return form.ownerGroupId !== item.ownerGroupId
    ? { ownerGroupId: form.ownerGroupId }
    : {};
}

async function submitForm(confirmBrokenSheets = false) {
  formBusy.value = true;
  formError.value = "";
  brokenSheets.value = undefined;

  try {
    // The schema is edited on the content type's page (schema builder).
    const body = {
      readableId: form.readableId,
      name: form.name,
      isPubliclyReadable: form.isPubliclyReadable,
      contentCategory: form.contentCategory,
      hasStrictSchema: form.hasStrictSchema,
    };

    if (editingType.value) {
      await $fetch(`/api/content-type/${editingType.value.id}`, {
        method: "PATCH",
        body: {
          ...body,
          ...ownerChange(editingType.value),
          ...(confirmBrokenSheets ? { confirmBrokenSheets: true } : {}),
        },
      });
      isFormOpen.value = false;
      await refresh();
    } else {
      const created = await $fetch<{ id: string }>("/api/content-type", {
        method: "POST",
        body: {
          ...body,
          systemId: form.systemId,
          ownerGroupId: form.ownerGroupId ?? undefined,
        },
      });
      isFormOpen.value = false;
      await navigateTo(`/types/${created.id}`);
    }
  } catch (error) {
    const broken = extractBrokenSheets(error);
    if (broken) brokenSheets.value = broken;
    else
      formError.value = extractApiErrorMessage(
        error,
        "Could not save content type.",
      );
  } finally {
    formBusy.value = false;
  }
}

const isDeleteOpen = ref(false);
const deletingType = ref<ContentTypeItem | null>(null);
const deleteBusy = ref(false);
const deleteError = ref("");

function confirmDelete(item: ContentTypeItem) {
  deletingType.value = item;
  deleteError.value = "";
  isDeleteOpen.value = true;
}

async function remove() {
  if (!deletingType.value) return;
  deleteBusy.value = true;
  deleteError.value = "";

  try {
    await $fetch(`/api/content-type/${deletingType.value.id}`, {
      method: "DELETE",
    });
    isDeleteOpen.value = false;
    await refresh();
  } catch (error) {
    deleteError.value = extractApiErrorMessage(
      error,
      "Could not delete content type. It may still be used by content or sheets.",
    );
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-highlighted">Content Types</h1>
      <UButton
        v-if="loggedIn"
        icon="i-lucide-plus"
        size="sm"
        :disabled="systems.length === 0"
        @click="openCreate()"
      >
        New Content Type
      </UButton>
    </div>

    <p v-if="loggedIn && systemsStatus === 'success' && systems.length === 0" class="text-sm text-muted">
      Create a system before adding content types.
    </p>

    <ResourceList :list="list" noun="Content Types">
<UTable
      :data="contentTypes"
      :columns="columns"
      :loading="status === 'pending'"
    >
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/types/${row.original.id}`"
          class="font-medium text-highlighted hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
      </template>

      <template #systemId-cell="{ row }">
        <NuxtLink
          v-if="systems.some((item) => item.id === row.original.systemId)"
          :to="`/systems/${row.original.systemId}`"
          class="text-primary hover:underline"
        >
          {{ systemName(row.original.systemId) }}
        </NuxtLink>
        <LookupSkeleton v-else-if="isLoading(systemsStatus)" />
        <template v-else>Unknown</template>
      </template>

      <template #contentCategory-cell="{ row }">
        {{ CONTENT_CATEGORY_LABELS[row.original.contentCategory] }}
      </template>

      <template #hasStrictSchema-cell="{ row }">
        {{ row.original.hasStrictSchema ? "Yes" : "No" }}
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
        <!-- Edit and delete both require edit access server-side. -->
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
        <ResourceListEmpty :list="list" plural="content types" />
      </template>
    </UTable>
    </ResourceList>

    <UModal
      v-model:open="isFormOpen"
      :title="editingType ? 'Edit Content Type' : 'New Content Type'"
      :description="
        editingType
          ? undefined
          : 'You\'ll define its fields on its page next.'
      "
    >
      <template #body>
        <UForm
          id="content-type-form"
          :state="form"
          class="space-y-4"
          @submit="submitForm()"
        >
          <UFormField name="name" label="Name" required>
            <UInput v-model="form.name" class="w-full" required />
          </UFormField>
          <ReadableIdField
            :model-value="form.readableId"
            :error="readableIdError"
            @update:model-value="onReadableIdInput"
          />
          <VisibilityField v-model="form.isPubliclyReadable" />
          <OwnerField
            v-if="!editingType || editingType.canChangeOwner"
            v-model="form.ownerGroupId"
            :original="editingType ? editingType.ownerGroupId : undefined"
          />
          <UFormField
            name="systemId"
            label="System"
            :description="
              editingType
                ? 'The system cannot be changed after creation.'
                : undefined
            "
            required
          >
            <USelect
              v-model="form.systemId"
              :items="systemOptions"
              class="w-full"
              :disabled="!!editingType"
            />
          </UFormField>
          <UFormField name="contentCategory" label="Category" required>
            <USelect
              v-model="form.contentCategory"
              :items="categoryOptions"
              class="w-full"
            />
          </UFormField>
          <UFormField
            name="hasStrictSchema"
            label="Strict schema"
            description="Reject content data that does not match the schema."
          >
            <USwitch v-model="form.hasStrictSchema" />
          </UFormField>
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            :description="formError"
          />
          <BrokenSheetsAlert
            v-if="brokenSheets"
            :broken="brokenSheets"
            :loading="formBusy"
            @confirm="submitForm(true)"
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
          form="content-type-form"
          label="Save"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete Content Type"
      :description="`Are you sure you want to delete &quot;${deletingType?.name}&quot;? This action cannot be undone.`"
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
