<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import {
  isCharacterCategory,
  type ContentCategory,
} from "#shared/content-categories";
import { extractApiErrorMessage } from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

interface ContentItem {
  id: string;
  slug: string;
  name: string;
  updatedAt: string;
  contentTypeId: string;
  data: Record<string, unknown>;
  canEdit: boolean;
  isPubliclyReadable: boolean;
}

interface ContentTypeItem {
  id: string;
  name: string;
  contentCategory: ContentCategory;
}

const {
  data: contentItems,
  status,
  refresh,
} = await useLazyFetch<ContentItem[]>("/api/content", {
  default: () => [],
});

const { data: contentTypes } = await useLazyFetch<ContentTypeItem[]>(
  "/api/content-type",
  {
    default: () => [],
  },
);

const standardContentTypes = computed(() =>
  contentTypes.value.filter(
    (item) => !isCharacterCategory(item.contentCategory),
  ),
);

const contentTypeOptions = computed(() =>
  standardContentTypes.value.map((item) => ({
    label: item.name,
    value: item.id,
  })),
);

const contentTypeIdSet = computed(
  () => new Set(standardContentTypes.value.map((item) => item.id)),
);

const contentRecords = computed(() =>
  contentItems.value.filter((item) =>
    contentTypeIdSet.value.has(item.contentTypeId),
  ),
);

function contentTypeName(contentTypeId: string) {
  return (
    standardContentTypes.value.find((item) => item.id === contentTypeId)
      ?.name ?? "Unknown"
  );
}

const columns: TableColumn<ContentItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "slug", header: "Slug" },
  { accessorKey: "isPubliclyReadable", header: "Visibility" },
  { accessorKey: "contentTypeId", header: "Type" },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
  },
  { id: "actions" },
];

const isFormOpen = ref(false);
const editingContent = ref<ContentItem | null>(null);
const form = reactive({
  slug: "",
  name: "",
  isPubliclyReadable: false,
  contentTypeId: "",
  data: "{}",
});
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);
const formBusy = ref(false);
const formError = ref("");

function openCreate() {
  const firstContentType = standardContentTypes.value[0];
  if (!firstContentType) return;

  editingContent.value = null;
  formError.value = "";
  form.slug = "";
  form.name = "";
  form.isPubliclyReadable = false;
  form.contentTypeId = firstContentType.id;
  form.data = "{}";
  resetSlugTouched(false);
  isFormOpen.value = true;
}

function openEdit(item: ContentItem) {
  editingContent.value = item;
  formError.value = "";
  form.slug = item.slug;
  form.name = item.name;
  form.isPubliclyReadable = item.isPubliclyReadable;
  form.contentTypeId = item.contentTypeId;
  form.data = JSON.stringify(item.data, null, 2);
  resetSlugTouched(true);
  isFormOpen.value = true;
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    const data = JSON.parse(form.data) as unknown;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error("Content data must be a JSON object.");
    }

    if (editingContent.value) {
      await $fetch(`/api/content/${editingContent.value.id}`, {
        method: "PATCH",
        body: {
          slug: form.slug,
          name: form.name,
          isPubliclyReadable: form.isPubliclyReadable,
          data,
        },
      });
    } else {
      await $fetch("/api/content", {
        method: "POST",
        body: {
          slug: form.slug,
          name: form.name,
          isPubliclyReadable: form.isPubliclyReadable,
          contentTypeId: form.contentTypeId,
          data,
        },
      });
    }

    isFormOpen.value = false;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not save content.");
  } finally {
    formBusy.value = false;
  }
}

const isDeleteOpen = ref(false);
const deletingContent = ref<ContentItem | null>(null);
const deleteBusy = ref(false);
const deleteError = ref("");

function confirmDelete(item: ContentItem) {
  deleteError.value = "";
  deletingContent.value = item;
  isDeleteOpen.value = true;
}

async function remove() {
  if (!deletingContent.value) return;
  deleteBusy.value = true;
  deleteError.value = "";

  try {
    await $fetch(`/api/content/${deletingContent.value.id}`, {
      method: "DELETE",
    });
    isDeleteOpen.value = false;
    await refresh();
  } catch (error) {
    deleteError.value = extractApiErrorMessage(
      error,
      "Could not delete content.",
    );
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-highlighted">Content</h1>
      <UButton
        icon="i-lucide-plus"
        size="sm"
        :disabled="standardContentTypes.length === 0"
        @click="openCreate"
      >
        New Content
      </UButton>
    </div>

    <p v-if="standardContentTypes.length === 0" class="text-sm text-muted">
      Create a content type with the General or Page category before adding
      content records.
    </p>

    <UTable
      :data="contentRecords"
      :columns="columns"
      :loading="status === 'pending'"
    >
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/content/${row.original.id}`"
          class="font-medium text-highlighted hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
      </template>

      <template #contentTypeId-cell="{ row }">
        {{ contentTypeName(row.original.contentTypeId) }}
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
        <p class="py-6 text-center text-sm text-muted">
          No content records yet.
        </p>
      </template>
    </UTable>

    <UModal
      v-model:open="isFormOpen"
      :title="editingContent ? 'Edit Content' : 'New Content'"
    >
      <template #body>
        <UForm
          id="content-form"
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
          <VisibilityField v-model="form.isPubliclyReadable" />
          <UFormField name="contentTypeId" label="Type" required>
            <USelect
              v-model="form.contentTypeId"
              :items="contentTypeOptions"
              class="w-full"
              :disabled="!!editingContent"
            />
          </UFormField>
          <UFormField name="data" label="Data (JSON)" required>
            <UTextarea v-model="form.data" class="w-full font-mono" :rows="8" />
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
          form="content-form"
          label="Save"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete Content"
      :description="`Are you sure you want to delete &quot;${deletingContent?.name}&quot;? This action cannot be undone.`"
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
