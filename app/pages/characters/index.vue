<script setup lang="ts">
import type { ResourceSource } from "#shared/resource-list";
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
  source: ResourceSource;
  readableId: string;
  // The owner's username or group ID, for the `owner/id` address.
  ownerReadableId: string | null;
  name: string;
  updatedAt: string;
  contentTypeId: string;
  systemId: string;
  canEdit: boolean;
  isPubliclyReadable: boolean;
}

interface ContentTypeItem {
  systemId: string;
  id: string;
  name: string;
  source: ResourceSource;
  contentCategory: ContentCategory;
}

// Player characters, NPCs, or both.
const categoryFilter = ref<ContentCategory | "all">("all");
const categoryFilterOptions = [
  { label: "All characters", value: "all" },
  { label: "Player Characters", value: "playerCharacter" },
  { label: "Non-Player Characters", value: "nonPlayerCharacter" },
];

const list = await useResourceList<ContentItem>("/api/content", loggedIn, { bySystem: true, extraQuery: () => ({ categories: categoryFilter.value === "all" ? CHARACTER_CATEGORIES.join(",") : categoryFilter.value }) });
const { items: characters, status, refresh } = list;
watch(categoryFilter, () => list.setPage(1));

const { data: contentTypes, status: contentTypesStatus } = await useLazyFetch<ContentTypeItem[]>(
  "/api/content-type",
  {
    default: () => [],
  },
);

const characterTypes = computed(() =>
  contentTypes.value.filter((item) => isCharacterCategory(item.contentCategory)),
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
  { accessorKey: "source", header: "Source" },
  { accessorKey: "isPubliclyReadable", header: "Visibility" },
  { accessorKey: "systemId", header: "System" },
  { accessorKey: "contentTypeId", header: "Character Type" },
  { id: "category", header: "Category" },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => formatShortDate(row.original.updatedAt),
  },
  actionsColumn(),
];

const isFormOpen = ref(false);
const form = reactive({
  readableId: "",
  name: "",
  isPubliclyReadable: false,
  ownerGroupId: null as string | null,
  systemId: "",
  contentTypeId: "",
});
const {
  systemOptions,
  typeOptions,
  selectStartingSystem,
  onSystemChange,
  onTypeChange,
} = useSystemTypePicker(form, characterTypes);
const systemPrefix = useSystemIdPrefix();
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(
  form,
  "readableId",
  () => systemPrefix(form.systemId),
);
const idAvailability = useResourceIdAvailability(form, "content");
const formBusy = ref(false);
const formError = ref("");

function openCreate() {
  if (!characterTypes.value.length) return;

  formError.value = "";
  form.readableId = "";
  form.name = "";
  form.isPubliclyReadable = false;
  form.ownerGroupId = null;
  selectStartingSystem();
  resetReadableIdTouched(false);
  isFormOpen.value = true;
}

// `?new=1` (the dashboard's "Create one" link) opens the New dialog once the
// content types have loaded, then drops that query param so a refresh doesn't reopen it.
const route = useRoute();
const router = useRouter();
// Only after mount, so the dialog doesn't open mid-hydration.
let mounted = false;
function openNewFromQuery() {
  if (!mounted || route.query.new === undefined) return;
  if (isLoading(contentTypesStatus.value)) return;
  if (contentTypesStatus.value === "success" && loggedIn.value) openCreate();
  const { new: _new, ...rest } = route.query;
  router.replace({ query: rest });
}
watch(contentTypesStatus, openNewFromQuery);
onMounted(() => {
  mounted = true;
  openNewFromQuery();
});

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
  <PageContainer>
    <PageHeader section="play" title="Characters">
      <UButton
        v-if="loggedIn"
        icon="i-lucide-plus"
        :disabled="characterTypes.length === 0"
        @click="openCreate"
      >
        New Character
      </UButton>
    </PageHeader>

    <p v-if="loggedIn && contentTypesStatus === 'success' && characterTypes.length === 0" class="text-sm text-muted">
      Create a content type with the Player Character or Non-Player Character
      category before adding characters.
    </p>

    <ResourceList
      :list="list"
      noun="Characters"
      singular="character"
      view-key="characters"
      default-view="cards"
    >
      <template #filters>
        <USelect
          v-if="characterTypes.length > 0"
          v-model="categoryFilter"
          :items="categoryFilterOptions"
          aria-label="Filter by category"
          :ui="{ base: 'h-10' }"
          class="w-56"
        />
      </template>
<UTable
      :data="characters"
      :columns="columns"
      :loading="status === 'pending'"
    >
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/characters/${row.original.id}`"
          class="text-[15px] font-bold text-highlighted hover:text-primary hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
        <span class="mt-0.5 block font-mono text-xs text-muted">
          {{ resourceAddress(row.original.ownerReadableId, row.original.readableId) }}
        </span>
      </template>

      <template #systemId-cell="{ row }">
        <SystemLink :system-id="row.original.systemId" />
      </template>

      <template #contentTypeId-cell="{ row }">
        <NuxtLink
          v-if="characterType(row.original.contentTypeId)"
          :to="`/types/${row.original.contentTypeId}`"
          class="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          {{ contentTypeName(row.original.contentTypeId) }}
        </NuxtLink>
        <LookupSkeleton v-else-if="isLoading(contentTypesStatus)" />
        <template v-else>Unknown</template>
      </template>

      <template #category-cell="{ row }">
        {{ categoryLabel(row.original.contentTypeId) }}
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
          :view-to="`/characters/${row.original.id}`"
          :name="row.original.name" :edit-to="`/characters/${row.original.id}`"
          @delete="confirmDelete(row.original)"
        />
      </template>

      <template #empty>
        <ResourceListEmpty :list="list" plural="characters" create-label="New Character" :create-disabled="characterTypes.length === 0" @create="openCreate()" />
      </template>
    </UTable>
          <template #cards>
        <ResourceCards :items="characters" :to="(item) => `/characters/${item.id}`">
          <template #actions="{ item }">
            <ResourceActionsMenu
              :can-edit="item.canEdit"
              :view-to="`/characters/${item.id}`"
              :name="item.name" :edit-to="`/characters/${item.id}`"
              @delete="confirmDelete(item)"
            />
          </template>
      <template #details="{ item }">
          <dt class="text-muted">System</dt>
          <dd><SystemLink :system-id="item.systemId" /></dd>
          <dt class="text-muted">Character Type</dt>
          <dd>
            <NuxtLink
              v-if="characterType(item.contentTypeId)"
              :to="`/types/${item.contentTypeId}`"
              class="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            >
              {{ contentTypeName(item.contentTypeId) }}
            </NuxtLink>
            <LookupSkeleton v-else-if="isLoading(contentTypesStatus)" />
            <template v-else>Unknown</template>
          </dd>
          <dt class="text-muted">Category</dt>
          <dd>{{ categoryLabel(item.contentTypeId) }}</dd>
      </template>
          <template #empty>
            <ResourceListEmpty :list="list" plural="characters" create-label="New Character" :create-disabled="characterTypes.length === 0" @create="openCreate()" />
          </template>
        </ResourceCards>
      </template>
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
            :availability="idAvailability"
            :error="readableIdError"
            @update:model-value="onReadableIdInput"
          />
          <UFormField name="systemId" label="System" required>
            <USelect
              :model-value="form.systemId"
              :items="systemOptions"
              class="w-full"
              @update:model-value="onSystemChange"
            >
              <template #item-label="{ item }">
                <ResourceOption :option="item as ResourceOptionItem" />
              </template>
            </USelect>
          </UFormField>
          <UFormField name="contentTypeId" label="Character Type" required>
            <USelect
              :model-value="form.contentTypeId"
              :items="typeOptions"
              class="w-full"
              @update:model-value="onTypeChange"
            >
              <template #item-label="{ item }">
                <ResourceOption :option="item as ResourceOptionItem" />
              </template>
            </USelect>
          </UFormField>
          <OwnerField v-model="form.ownerGroupId" />
          <VisibilityField v-model="form.isPubliclyReadable" />
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
  </PageContainer>
</template>
