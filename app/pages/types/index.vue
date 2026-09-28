<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { extractApiErrorMessage } from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

type ContentCategory =
  "general" | "nonPlayerCharacter" | "document" | "playerCharacter";

interface ContentTypeItem {
  id: string;
  slug: string;
  name: string;
  systemId: string;
  contentCategory: ContentCategory;
  hasStrictSchema: boolean;
  schema: Record<string, unknown>;
  canEdit: boolean;
}

interface SystemItem {
  id: string;
  name: string;
}

const categoryLabels: Record<ContentCategory, string> = {
  general: "General",
  nonPlayerCharacter: "Non-Player Character",
  document: "Document",
  playerCharacter: "Player Character",
};

const categoryOptions = Object.entries(categoryLabels).map(
  ([value, label]) => ({ label, value }),
);

const {
  data: contentTypes,
  status,
  refresh,
} = await useLazyFetch<ContentTypeItem[]>("/api/content-type", {
  default: () => [],
});

const { data: systems } = await useLazyFetch<SystemItem[]>("/api/system", {
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
  { accessorKey: "slug", header: "Slug" },
  { accessorKey: "systemId", header: "System" },
  { accessorKey: "contentCategory", header: "Category" },
  { accessorKey: "hasStrictSchema", header: "Strict Schema" },
  { id: "actions" },
];

const isFormOpen = ref(false);
const editingType = ref<ContentTypeItem | null>(null);
const form = reactive({
  slug: "",
  name: "",
  systemId: "",
  contentCategory: "general" as ContentCategory,
  hasStrictSchema: false,
  schema: "{}",
});
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);
const formBusy = ref(false);
const formError = ref("");

function openCreate(systemId?: string) {
  const system =
    systems.value.find((item) => item.id === systemId) ?? systems.value[0];
  if (!system) return;

  editingType.value = null;
  formError.value = "";
  form.slug = "";
  form.name = "";
  form.systemId = system.id;
  form.contentCategory = "general";
  form.hasStrictSchema = false;
  form.schema = "{}";
  resetSlugTouched(false);
  isFormOpen.value = true;
}

function openEdit(item: ContentTypeItem) {
  editingType.value = item;
  formError.value = "";
  form.slug = item.slug;
  form.name = item.name;
  form.systemId = item.systemId;
  form.contentCategory = item.contentCategory;
  form.hasStrictSchema = item.hasStrictSchema;
  form.schema = JSON.stringify(item.schema, null, 2);
  resetSlugTouched(true);
  isFormOpen.value = true;
}

// `/types?systemId=…` (from a System's detail page) opens the create form with
// that System preselected, then drops the query so a refresh doesn't reopen it.
const route = useRoute();
watch(
  systems,
  (items) => {
    const systemId = route.query.systemId;
    if (typeof systemId !== "string" || items.length === 0) return;
    openCreate(systemId);
    navigateTo({ query: {} }, { replace: true });
  },
  { immediate: true },
);

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    const schema = JSON.parse(form.schema) as unknown;
    if (
      typeof schema !== "object" ||
      schema === null ||
      Array.isArray(schema)
    ) {
      throw new Error("Schema must be a JSON object.");
    }

    const body = {
      slug: form.slug,
      name: form.name,
      contentCategory: form.contentCategory,
      hasStrictSchema: form.hasStrictSchema,
      schema,
    };

    if (editingType.value) {
      await $fetch(`/api/content-type/${editingType.value.id}`, {
        method: "PATCH",
        body,
      });
    } else {
      await $fetch("/api/content-type", {
        method: "POST",
        body: { ...body, systemId: form.systemId },
      });
    }

    isFormOpen.value = false;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(
      error,
      "Could not save Content Type.",
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
      "Could not delete Content Type. It may still be used by Content or Sheets.",
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
        icon="i-lucide-plus"
        size="sm"
        :disabled="systems.length === 0"
        @click="openCreate()"
      >
        New Content Type
      </UButton>
    </div>

    <p v-if="systems.length === 0" class="text-sm text-muted">
      Create a System before adding Content Types.
    </p>

    <UTable
      :data="contentTypes"
      :columns="columns"
      :loading="status === 'pending'"
    >
      <template #systemId-cell="{ row }">
        <NuxtLink
          :to="`/systems/${row.original.systemId}`"
          class="text-primary hover:underline"
        >
          {{ systemName(row.original.systemId) }}
        </NuxtLink>
      </template>

      <template #contentCategory-cell="{ row }">
        {{ categoryLabels[row.original.contentCategory] }}
      </template>

      <template #hasStrictSchema-cell="{ row }">
        {{ row.original.hasStrictSchema ? "Yes" : "No" }}
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
        <p class="py-6 text-center text-sm text-muted">
          No Content Types yet.
        </p>
      </template>
    </UTable>

    <UModal
      v-model:open="isFormOpen"
      :title="editingType ? 'Edit Content Type' : 'New Content Type'"
    >
      <template #body>
        <UForm
          id="content-type-form"
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
          <UFormField
            name="systemId"
            label="System"
            :description="
              editingType
                ? 'The System cannot be changed after creation.'
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
            description="Reject Content data that does not match the schema."
          >
            <USwitch v-model="form.hasStrictSchema" />
          </UFormField>
          <UFormField name="schema" label="Schema (JSON)" required>
            <UTextarea
              v-model="form.schema"
              class="w-full font-mono"
              :rows="10"
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
