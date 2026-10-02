<script setup lang="ts">
import type { ResourceSource } from "#shared/resource-list";
import type { TableColumn } from "@nuxt/ui";
import {
  extractApiErrorMessage,
  extractDefaultReplacement,
} from "~/utils/api-error";

// Logged-out visitors can view public items here; creating needs an account.
const loggedIn = await useLoggedIn();

interface SheetItem {
  id: string;
  source: ResourceSource;
  readableId: string;
  name: string;
  updatedAt: string;
  contentTypeId: string;
  systemId: string;
  isDefault: boolean;
  canEdit: boolean;
  isPubliclyReadable: boolean;
}

interface ContentTypeItem {
  systemId: string;
  id: string;
  name: string;
  source: ResourceSource;
  canEdit: boolean;
}

const { systemId: currentSystemId } = useCurrentSystem();
const list = await useResourceList<SheetItem>("/api/sheet", loggedIn, { bySystem: true });
const { items: sheets, status, refresh } = list;

const { data: contentTypes, status: contentTypesStatus } = await useLazyFetch<ContentTypeItem[]>(
  "/api/content-type",
  { default: () => [] },
);

const { systemLabel } = useSystems();
const contentTypeOptions = computed(() =>
  contentTypes.value.map((item) =>
    resourceOption(item.id, {
      name: item.name,
      systemName: systemLabel(item.systemId),
      source: item.source,
    }),
  ),
);

function contentTypeName(contentTypeId: string) {
  return (
    contentTypes.value.find((item) => item.id === contentTypeId)?.name ??
    "Unknown"
  );
}

const columns: TableColumn<SheetItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "source", header: "Source" },
  { accessorKey: "isPubliclyReadable", header: "Visibility" },
  { accessorKey: "systemId", header: "System" },
  { accessorKey: "contentTypeId", header: "Content Type" },
  { accessorKey: "isDefault", header: "Default" },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleDateString(undefined, { dateStyle: "medium" }),
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
  isDefault: false,
});
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(form);
const idAvailability = useResourceIdAvailability(form, "sheet");

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
    contentTypes.value.find((item) => item.systemId === currentSystemId.value) ??
    contentTypes.value[0];
  if (!selectedType) return;

  formError.value = "";
  replaceDefault.value = undefined;
  form.readableId = "";
  form.name = "";
  form.isPubliclyReadable = false;
  form.ownerGroupId = null;
  form.contentTypeId = selectedType.id;
  form.isDefault = false;
  resetReadableIdTouched(false);
  isFormOpen.value = true;
}

// `/sheets?contentTypeId=…` (from a Content Type's detail page) opens the
// create form with that type preselected, then drops the query.
const route = useRoute();
watch(
  contentTypes,
  (items) => {
    const contentTypeId = route.query.contentTypeId;
    if (
      !loggedIn.value ||
      typeof contentTypeId !== "string" ||
      items.length === 0
    )
      return;
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
        readableId: form.readableId,
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
  <PageContainer>
    <PageHeader eyebrow="Build" title="Sheets">
      <UButton
        v-if="loggedIn"
        icon="i-lucide-plus"
        size="sm"
        :disabled="contentTypes.length === 0"
        @click="openCreate()"
      >
        New Sheet
      </UButton>
    </PageHeader>

    <p v-if="loggedIn && contentTypesStatus === 'success' && contentTypes.length === 0" class="text-sm text-muted">
      Create a content type before adding sheets.
    </p>

    <ResourceList
      :list="list"
      noun="Sheets"
      view-key="sheets"
      default-view="table"
    >
<UTable :data="sheets" :columns="columns" :loading="status === 'pending'">
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/sheets/${row.original.id}`"
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
          v-if="contentTypes.some((item) => item.id === row.original.contentTypeId)"
          :to="`/types/${row.original.contentTypeId}`"
          class="text-primary hover:underline"
        >
          {{ contentTypeName(row.original.contentTypeId) }}
        </NuxtLink>
        <LookupSkeleton v-else-if="isLoading(contentTypesStatus)" />
        <template v-else>Unknown</template>
      </template>

      <template #isDefault-cell="{ row }">
        <UBadge v-if="row.original.isDefault" variant="subtle">
          Default
        </UBadge>
        <!-- An empty slot makes the table print the raw `false` instead. -->
        <span v-else />
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
          :view-to="`/sheets/${row.original.id}`"
          :name="row.original.name" :edit-to="`/sheets/${row.original.id}/edit`"
          @delete="confirmDelete(row.original)"
        />
      </template>

      <template #empty>
        <ResourceListEmpty :list="list" plural="sheets" create-label="New Sheet" :create-disabled="contentTypes.length === 0" @create="openCreate()" />
      </template>
    </UTable>
          <template #cards>
        <ResourceCards :items="sheets" :to="(item) => `/sheets/${item.id}`">
          <template #actions="{ item }">
            <ResourceActionsMenu
              :can-edit="item.canEdit"
              :view-to="`/sheets/${item.id}`"
              :name="item.name" :edit-to="`/sheets/${item.id}/edit`"
              @delete="confirmDelete(item)"
            />
          </template>
      <template #badges="{ item }">
        <UBadge v-if="item.isDefault" variant="subtle">Default</UBadge>
      </template>
      <template #details="{ item }">
          <dt class="text-muted">System</dt>
          <dd><SystemLink :system-id="item.systemId" /></dd>
          <dt class="text-muted">Content Type</dt>
          <dd>
            <NuxtLink
              v-if="contentTypes.some((type) => type.id === item.contentTypeId)"
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
            <ResourceListEmpty :list="list" plural="sheets" create-label="New Sheet" :create-disabled="contentTypes.length === 0" @create="openCreate()" />
          </template>
        </ResourceCards>
      </template>
    </ResourceList>

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
          <ReadableIdField
            :model-value="form.readableId"
            :availability="idAvailability"
            :error="readableIdError"
            @update:model-value="onReadableIdInput"
          />
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
            >
              <template #item-label="{ item }">
                <ResourceOption :option="item as ResourceOptionItem" />
              </template>
            </USelect>
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
  </PageContainer>
</template>
