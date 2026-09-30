<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import {
  CHARACTER_CATEGORIES,
  CONTENT_CATEGORY_LABELS,
  isCharacterCategory,
  type ContentCategory,
} from "#shared/content-categories";
import { extractApiErrorMessage } from "~/utils/api-error";

// Logged-out visitors can view public items here; creating needs an account.
const loggedIn = await useLoggedIn();

interface ContentItem {
  id: string;
  official: boolean;
  readableId: string;
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

// Player characters, NPCs, or both.
const categoryFilter = ref<ContentCategory | "all">("all");
const categoryFilterOptions = [
  { label: "All characters", value: "all" },
  { label: "Player Characters", value: "playerCharacter" },
  { label: "Non-Player Characters", value: "nonPlayerCharacter" },
];

const list = await useResourceList<ContentItem>("/api/content", loggedIn, { extraQuery: () => ({ categories: categoryFilter.value === "all" ? CHARACTER_CATEGORIES.join(",") : categoryFilter.value }) });
const { items: characters, status, refresh } = list;
watch(categoryFilter, () => list.setPage(1));

const { data: contentTypes } = await useLazyFetch<ContentTypeItem[]>(
  "/api/content-type",
  {
    default: () => [],
  },
);

const characterTypes = computed(() =>
  contentTypes.value.filter((item) => isCharacterCategory(item.contentCategory)),
);

const characterTypeOptions = computed(() =>
  characterTypes.value.map((item) => ({ label: item.name, value: item.id })),
);


function characterType(contentTypeId: string) {
  return characterTypes.value.find((item) => item.id === contentTypeId);
}

function contentTypeName(contentTypeId: string) {
  return characterType(contentTypeId)?.name ?? "Unknown";
}

function categoryLabel(contentTypeId: string) {
  const category = characterType(contentTypeId)?.contentCategory;
  return category ? CONTENT_CATEGORY_LABELS[category] : "";
}

const columns: TableColumn<ContentItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "official", header: "Source" },
  { accessorKey: "readableId", header: "ID" },
  { accessorKey: "isPubliclyReadable", header: "Visibility" },
  { accessorKey: "contentTypeId", header: "Character Type" },
  { id: "category", header: "Category" },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
  },
  { id: "actions" },
];

const isFormOpen = ref(false);
const form = reactive({
  readableId: "",
  name: "",
  isPubliclyReadable: false,
  ownerGroupId: null as string | null,
  contentTypeId: "",
});
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(form);
const formBusy = ref(false);
const formError = ref("");

function openCreate() {
  const firstCharacterType = characterTypes.value[0];
  if (!firstCharacterType) return;

  formError.value = "";
  form.readableId = "";
  form.name = "";
  form.isPubliclyReadable = false;
  form.ownerGroupId = null;
  form.contentTypeId = firstCharacterType.id;
  resetReadableIdTouched(false);
  isFormOpen.value = true;
}

// Creates with just the basics; the characters page's sheet fills in the rest.
async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    const created = await $fetch<{ id: string }>("/api/content", {
      method: "POST",
      body: {
        readableId: form.readableId,
        name: form.name,
        isPubliclyReadable: form.isPubliclyReadable,
        contentTypeId: form.contentTypeId,
        ownerGroupId: form.ownerGroupId ?? undefined,
      },
    });
    isFormOpen.value = false;
    await navigateTo(`/characters/${created.id}`);
  } catch (error) {
    formError.value = extractApiErrorMessage(
      error,
      "Could not save character.",
    );
  } finally {
    formBusy.value = false;
  }
}

const isDeleteOpen = ref(false);
const deletingCharacter = ref<ContentItem | null>(null);
const deleteBusy = ref(false);
const deleteError = ref("");

function confirmDelete(item: ContentItem) {
  deleteError.value = "";
  deletingCharacter.value = item;
  isDeleteOpen.value = true;
}

async function remove() {
  if (!deletingCharacter.value) return;
  deleteBusy.value = true;
  deleteError.value = "";

  try {
    await $fetch(`/api/content/${deletingCharacter.value.id}`, {
      method: "DELETE",
    });
    isDeleteOpen.value = false;
    await refresh();
  } catch (error) {
    deleteError.value = extractApiErrorMessage(
      error,
      "Could not delete character.",
    );
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
        v-if="loggedIn"
        icon="i-lucide-plus"
        size="sm"
        :disabled="characterTypes.length === 0"
        @click="openCreate"
      >
        New Character
      </UButton>
    </div>

    <p v-if="loggedIn && characterTypes.length === 0" class="text-sm text-muted">
      Create a content type with the Player Character or Non-Player Character
      category before adding characters.
    </p>

    <USelect
      v-if="characterTypes.length > 0"
      v-model="categoryFilter"
      :items="categoryFilterOptions"
      aria-label="Filter by category"
      class="w-56"
    />

    <ResourceList :list="list" noun="Characters">
<UTable
      :data="characters"
      :columns="columns"
      :loading="status === 'pending'"
    >
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/characters/${row.original.id}`"
          class="font-medium text-highlighted hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
      </template>

      <template #contentTypeId-cell="{ row }">
        <NuxtLink
          v-if="characterType(row.original.contentTypeId)"
          :to="`/types/${row.original.contentTypeId}`"
          class="text-primary hover:underline"
        >
          {{ contentTypeName(row.original.contentTypeId) }}
        </NuxtLink>
        <template v-else>Unknown</template>
      </template>

      <template #category-cell="{ row }">
        {{ categoryLabel(row.original.contentTypeId) }}
      </template>

      <template #official-cell="{ row }">
        <SourceBadge :official="row.original.official" />
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
                to: `/characters/${row.original.id}`,
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
        <p class="py-6 text-center text-sm text-muted">{{ list.search.value ? 'Nothing matches your search.' : 'No characters yet.' }}</p>
      </template>
    </UTable>
    </ResourceList>

    <UModal
      v-model:open="isFormOpen"
      title="New Character"
      description="You'll fill in the rest on its sheet next."
    >
      <template #body>
        <UForm
          id="character-form"
          :state="form"
          class="space-y-4"
          @submit="submitForm"
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
          <OwnerField v-model="form.ownerGroupId" />
          <UFormField name="contentTypeId" label="Character Type" required>
            <USelect
              v-model="form.contentTypeId"
              :items="characterTypeOptions"
              class="w-full"
            />
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
          label="Create"
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
