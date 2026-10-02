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
  // The owner's username or group ID, for the `owner/id` address.
  ownerReadableId: string | null;
  name: string;
  systemId: string;
  contentCategory: ContentCategory;
  hasStrictSchema: boolean;
  showSheetWarnings: boolean;
  canEdit: boolean;
  ownerGroupId: string | null;
  canChangeOwner: boolean;
  isPubliclyReadable: boolean;
}

const categoryOptions = Object.entries(CONTENT_CATEGORY_LABELS).map(
  ([value, label]) => ({ label, value }),
);

const { systemId: currentSystemId } = useCurrentSystem();
const list = await useResourceList<ContentTypeItem>("/api/content-type", loggedIn, { bySystem: true });
const { items: contentTypes, status, refresh } = list;

const { systems, status: systemsStatus } = useSystems();

const systemOptions = computed(() =>
  systems.value.map((item) =>
    resourceOption(item.id, { name: item.name, source: item.source }),
  ),
);

const columns: TableColumn<ContentTypeItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "source", header: "Source" },
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
  showSheetWarnings: false,
});
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(form);
const idAvailability = useResourceIdAvailability(form, "contentType", () => editingType.value ?? undefined);
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
  form.showSheetWarnings = false;
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
  form.showSheetWarnings = item.showSheetWarnings;
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

// Switching an existing content type from strict to non-strict pre-sets the
// warnings to on (still changeable); switching back restores the saved value.
function onStrictChange(strict: boolean) {
  const original = editingType.value;
  if (!original) return;
  form.showSheetWarnings = strict
    ? original.showSheetWarnings
    : original.hasStrictSchema || original.showSheetWarnings;
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
      showSheetWarnings: form.showSheetWarnings,
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
  <PageContainer>
    <PageHeader section="build" title="Content Types">
      <UButton
        v-if="loggedIn"
        icon="i-lucide-plus"
        :disabled="systems.length === 0"
        @click="openCreate()"
      >
        New Content Type
      </UButton>
    </PageHeader>

    <p v-if="loggedIn && systemsStatus === 'success' && systems.length === 0" class="text-sm text-muted">
      Create a system before adding content types.
    </p>

    <ResourceList
      :list="list"
      noun="Content Types"
      singular="content type"
      view-key="types"
      default-view="table"
    >
<UTable
      :data="contentTypes"
      :columns="columns"
      :loading="status === 'pending'"
    >
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/types/${row.original.id}`"
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
        <ResourceActionsMenu
          :can-edit="row.original.canEdit"
          :view-to="`/types/${row.original.id}`"
          :name="row.original.name" @edit="openEdit(row.original)"
          @delete="confirmDelete(row.original)"
        />
      </template>

      <template #empty>
        <ResourceListEmpty :list="list" plural="content types" create-label="New Content Type" :create-disabled="systems.length === 0" @create="openCreate()" />
      </template>
    </UTable>
          <template #cards>
        <ResourceCards :items="contentTypes" :to="(item) => `/types/${item.id}`">
          <template #actions="{ item }">
            <ResourceActionsMenu
              :can-edit="item.canEdit"
              :view-to="`/types/${item.id}`"
              :name="item.name" @edit="openEdit(item)"
              @delete="confirmDelete(item)"
            />
          </template>
      <template #details="{ item }">
          <dt class="text-muted">System</dt>
          <dd><SystemLink :system-id="item.systemId" /></dd>
          <dt class="text-muted">Category</dt>
          <dd>{{ CONTENT_CATEGORY_LABELS[item.contentCategory] }}</dd>
          <dt class="text-muted">Strict Schema</dt>
          <dd>{{ item.hasStrictSchema ? "Yes" : "No" }}</dd>
      </template>
          <template #empty>
            <ResourceListEmpty :list="list" plural="content types" create-label="New Content Type" :create-disabled="systems.length === 0" @create="openCreate()" />
          </template>
        </ResourceCards>
      </template>
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
            :availability="idAvailability"
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
            >
              <template #item-label="{ item }">
                <ResourceOption :option="item as ResourceOptionItem" />
              </template>
            </USelect>
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
            <USwitch
              v-model="form.hasStrictSchema"
              @update:model-value="onStrictChange"
            />
          </UFormField>
          <UFormField
            v-if="!form.hasStrictSchema"
            name="showSheetWarnings"
            label="Show Sheet Warnings"
            description="In the Sheet editor, warn about field paths and {interpolations} that are not in the schema, and paths into free-form objects."
          >
            <USwitch v-model="form.showSheetWarnings" />
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
  </PageContainer>
</template>
