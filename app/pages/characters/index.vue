<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { extractApiErrorMessage } from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

interface ContentItem {
  id: string;
  slug: string;
  name: string;
  updatedAt: string;
  contentTypeId: string;
  data: Record<string, unknown>;
}

interface ContentTypeItem {
  id: string;
  name: string;
  contentCategory: "general" | "nonPlayerCharacter" | "document" | "playerCharacter";
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

const characterTypes = computed(() =>
  contentTypes.value.filter((item) => item.contentCategory === "playerCharacter"),
);

const characterTypeOptions = computed(() =>
  characterTypes.value.map((item) => ({ label: item.name, value: item.id })),
);

const characterTypeIdSet = computed(
  () => new Set(characterTypes.value.map((item) => item.id)),
);

const characters = computed(() =>
  contentItems.value.filter((item) => characterTypeIdSet.value.has(item.contentTypeId)),
);

function contentTypeName(contentTypeId: string) {
  return (
    characterTypes.value.find((item) => item.id === contentTypeId)?.name ??
    "Unknown"
  );
}

const columns: TableColumn<ContentItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "slug", header: "Slug" },
  { accessorKey: "contentTypeId", header: "Character Type" },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
  },
  { id: "actions" },
];

const isFormOpen = ref(false);
const editingCharacter = ref<ContentItem | null>(null);
const form = reactive({
  slug: "",
  name: "",
  contentTypeId: "",
  data: "{}",
});
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);
const formBusy = ref(false);
const formError = ref("");

function openCreate() {
  const firstCharacterType = characterTypes.value[0];
  if (!firstCharacterType) return;

  editingCharacter.value = null;
  formError.value = "";
  form.slug = "";
  form.name = "";
  form.contentTypeId = firstCharacterType.id;
  form.data = "{}";
  resetSlugTouched(false);
  isFormOpen.value = true;
}

function openEdit(item: ContentItem) {
  editingCharacter.value = item;
  formError.value = "";
  form.slug = item.slug;
  form.name = item.name;
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
      throw new Error("Character data must be a JSON object.");
    }

    if (editingCharacter.value) {
      await $fetch(`/api/content/${editingCharacter.value.id}`, {
        method: "PATCH",
        body: {
          slug: form.slug,
          name: form.name,
          data,
        },
      });
    } else {
      await $fetch("/api/content", {
        method: "POST",
        body: {
          slug: form.slug,
          name: form.name,
          contentTypeId: form.contentTypeId,
          data,
        },
      });
    }

    isFormOpen.value = false;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not save Character.");
  } finally {
    formBusy.value = false;
  }
}

const isDeleteOpen = ref(false);
const deletingCharacter = ref<ContentItem | null>(null);
const deleteBusy = ref(false);

function confirmDelete(item: ContentItem) {
  deletingCharacter.value = item;
  isDeleteOpen.value = true;
}

async function remove() {
  if (!deletingCharacter.value) return;
  deleteBusy.value = true;

  try {
    await $fetch(`/api/content/${deletingCharacter.value.id}`, {
      method: "DELETE",
    });
    isDeleteOpen.value = false;
    await refresh();
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-highlighted">Characters</h1>
      <UButton
        icon="i-lucide-plus"
        size="sm"
        :disabled="characterTypes.length === 0"
        @click="openCreate"
      >
        New Character
      </UButton>
    </div>

    <p v-if="characterTypes.length === 0" class="text-sm text-muted">
      Create a ContentType with category "playerCharacter" before adding characters.
    </p>

    <UTable :data="characters" :columns="columns" :loading="status === 'pending'">
      <template #contentTypeId-cell="{ row }">
        {{ contentTypeName(row.original.contentTypeId) }}
      </template>

      <template #actions-cell="{ row }">
        <UDropdownMenu
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
        <p class="py-6 text-center text-sm text-muted">No Characters yet.</p>
      </template>
    </UTable>

    <UModal
      v-model:open="isFormOpen"
      :title="editingCharacter ? 'Edit Character' : 'New Character'"
    >
      <template #body>
        <UForm id="character-form" :state="form" class="space-y-4" @submit="submitForm">
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
          <UFormField name="contentTypeId" label="Character Type" required>
            <USelect
              v-model="form.contentTypeId"
              :items="characterTypeOptions"
              class="w-full"
              :disabled="!!editingCharacter"
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
          form="character-form"
          label="Save"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete Character"
      :description="`Are you sure you want to delete &quot;${deletingCharacter?.name}&quot;? This action cannot be undone.`"
      :ui="{ footer: 'justify-end' }"
    >
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
