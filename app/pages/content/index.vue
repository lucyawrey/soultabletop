<script setup lang="ts">
import type { ResourceSource } from "#shared/resource-list";
import type { TableColumn } from "@nuxt/ui";
import {
  isCharacterCategory,
  NON_CHARACTER_CATEGORIES,
  type ContentCategory,
} from "#shared/content-categories";
import { extractApiErrorMessage } from "~/utils/api-error";

// Logged-out visitors can view public items here; creating needs an account.
const loggedIn = await useLoggedIn();

interface ContentItem {
  id: string;
  source: ResourceSource;
  readableId: string;
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

const list = await useResourceList<ContentItem>("/api/content", loggedIn, { bySystem: true, extraQuery: { categories: NON_CHARACTER_CATEGORIES.join(",") } });
const { items: contentRecords, status, refresh } = list;

const { systemId: currentSystemId } = useCurrentSystem();
const { data: contentTypes, status: contentTypesStatus } = await useLazyFetch<ContentTypeItem[]>(
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

const { systemLabel } = useSystems();
const contentTypeOptions = computed(() =>
  standardContentTypes.value.map((item) =>
    resourceOption(item.id, {
      name: item.name,
      systemName: systemLabel(item.systemId),
      source: item.source,
    }),
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
  { accessorKey: "source", header: "Source" },
  { accessorKey: "isPubliclyReadable", header: "Visibility" },
  { accessorKey: "systemId", header: "System" },
  { accessorKey: "contentTypeId", header: "Type" },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => formatShortDate(row.original.updatedAt),
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
const idAvailability = useResourceIdAvailability(form, "content");
const formBusy = ref(false);
const formError = ref("");

function openCreate() {
  const firstContentType =
    standardContentTypes.value.find((item) => item.systemId === currentSystemId.value) ??
    standardContentTypes.value[0];
  if (!firstContentType) return;

  formError.value = "";
  form.readableId = "";
  form.name = "";
  form.isPubliclyReadable = false;
  form.ownerGroupId = null;
  form.contentTypeId = firstContentType.id;
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

// Creates with just the basics; the content page's sheet fills in the rest.
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
    await navigateTo(`/content/${created.id}`);
  } catch (error) {
    formError.value = extractApiErrorMessage(
      error,
      "Could not save content.",
    );
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
  <PageContainer>
    <PageHeader eyebrow="Play" title="Content">
      <UButton
        v-if="loggedIn"
        icon="i-lucide-plus"
        :disabled="standardContentTypes.length === 0"
        @click="openCreate"
      >
        New Content
      </UButton>
    </PageHeader>

    <p v-if="loggedIn && contentTypesStatus === 'success' && standardContentTypes.length === 0" class="text-sm text-muted">
      Create a content type with the General or Page category before adding
      content records.
    </p>

    <ResourceList
      :list="list"
      noun="Content"
      view-key="content"
      default-view="table"
    >
<UTable
      :data="contentRecords"
      :columns="columns"
      :loading="status === 'pending'"
    >
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/content/${row.original.id}`"
          class="font-bold text-highlighted hover:text-primary hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
        <span class="mt-0.5 block font-mono text-xs text-muted">
          {{ row.original.readableId }}
        </span>
      </template>

      <template #systemId-cell="{ row }">
        <SystemLink :system-id="row.original.systemId" />
      </template>

      <template #contentTypeId-cell="{ row }">
        <NuxtLink
          v-if="standardContentTypes.some((item) => item.id === row.original.contentTypeId)"
          :to="`/types/${row.original.contentTypeId}`"
          class="text-primary hover:underline"
        >
          {{ contentTypeName(row.original.contentTypeId) }}
        </NuxtLink>
        <LookupSkeleton v-else-if="isLoading(contentTypesStatus)" />
        <template v-else>Unknown</template>
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
          :view-to="`/content/${row.original.id}`"
          :name="row.original.name" :edit-to="`/content/${row.original.id}`"
          @delete="confirmDelete(row.original)"
        />
      </template>

      <template #empty>
        <ResourceListEmpty :list="list" plural="content" uncountable create-label="New Content" :create-disabled="standardContentTypes.length === 0" @create="openCreate()" />
      </template>
    </UTable>
          <template #cards>
        <ResourceCards :items="contentRecords" :to="(item) => `/content/${item.id}`">
          <template #actions="{ item }">
            <ResourceActionsMenu
              :can-edit="item.canEdit"
              :view-to="`/content/${item.id}`"
              :name="item.name" :edit-to="`/content/${item.id}`"
              @delete="confirmDelete(item)"
            />
          </template>
      <template #details="{ item }">
          <dt class="text-muted">System</dt>
          <dd><SystemLink :system-id="item.systemId" /></dd>
          <dt class="text-muted">Type</dt>
          <dd>
            <NuxtLink
              v-if="standardContentTypes.some((type) => type.id === item.contentTypeId)"
              :to="`/types/${item.contentTypeId}`"
              class="text-primary hover:underline"
            >
              {{ contentTypeName(item.contentTypeId) }}
            </NuxtLink>
            <LookupSkeleton v-else-if="isLoading(contentTypesStatus)" />
            <template v-else>Unknown</template>
          </dd>
      </template>
          <template #empty>
            <ResourceListEmpty :list="list" plural="content" uncountable create-label="New Content" :create-disabled="standardContentTypes.length === 0" @create="openCreate()" />
          </template>
        </ResourceCards>
      </template>
    </ResourceList>

    <UModal
      v-model:open="isFormOpen"
      title="New Content"
      description="You'll fill in the rest on its sheet next."
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
          <ReadableIdField
            :model-value="form.readableId"
            :availability="idAvailability"
            :error="readableIdError"
            @update:model-value="onReadableIdInput"
          />
          <VisibilityField v-model="form.isPubliclyReadable" />
          <OwnerField v-model="form.ownerGroupId" />
          <UFormField name="contentTypeId" label="Type" required>
            <USelect
              v-model="form.contentTypeId"
              :items="contentTypeOptions"
              class="w-full"
            >
              <template #item-label="{ item }">
                <ResourceOption :option="item as ResourceOptionItem" />
              </template>
            </USelect>
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
          label="Create"
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
  </PageContainer>
</template>
