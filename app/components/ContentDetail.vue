<script setup lang="ts">
import {
  GENERATED_SHEET_NAME,
  generateSheetMarkup,
  type ContentCategory,
} from "#shared/sheet/generate";
import type { SheetRefs } from "#shared/sheet/runtime";
import type { SheetSchemas } from "#shared/sheet/validate";
import { extractApiErrorMessage } from "~/utils/api-error";

// Shared by /content/[id] and /characters/[id]: both are `content` Resources,
// differing only in their ContentType's category and where "back" goes.
const props = defineProps<{
  id: string;
  label: string;
  listPath: string;
  listLabel: string;
}>();

interface ResolvedSheet {
  id: string | null; // null: generated from the schema
  name: string;
  markup: string;
  css: string;
  source: "selected" | "default" | "generated";
  defaultEditMode: boolean;
  defaultAutosave: boolean;
  canEdit: boolean;
}

interface ContentDetail {
  id: string;
  slug: string;
  name: string;
  updatedAt: string;
  contentTypeId: string;
  contentCategory: ContentCategory;
  sheetId: string | null;
  data: Record<string, unknown>;
  canEdit: boolean;
  isPubliclyReadable: boolean;
  sheet: ResolvedSheet;
  schemas: SheetSchemas;
  refs: SheetRefs;
}

interface NamedItem {
  id: string;
  name: string;
}

interface SheetItem {
  id: string;
  name: string;
  contentTypeId: string;
  markup: string;
  cssStyles: string;
  canEdit: boolean;
}

const { data: item, refresh } = await useFetch<ContentDetail>(
  `/api/content/${props.id}`,
);

const { data: contentTypes } = await useLazyFetch<NamedItem[]>(
  "/api/content-type",
  { default: () => [] },
);
const { data: sheets } = await useLazyFetch<SheetItem[]>("/api/sheet", {
  default: () => [],
});

const contentType = computed(() =>
  contentTypes.value.find((type) => type.id === item.value?.contentTypeId),
);
const typeSheets = computed(() =>
  sheets.value.filter((entry) => entry.contentTypeId === item.value?.contentTypeId),
);

// Which Sheet to view with, for this page view only. `null` follows the
// server's choice (the saved Sheet, else the default, else generated).
const GENERATED = "generated";
const viewSheetId = ref<string | null>(null);
const sheetOptions = computed(() => [
  { label: GENERATED_SHEET_NAME, value: GENERATED },
  ...typeSheets.value.map((entry) => ({ label: entry.name, value: entry.id })),
]);
const viewSheet = computed(() => {
  const content = item.value;
  if (!content) return undefined;
  const chosen = viewSheetId.value;
  if (!chosen || chosen === (content.sheet.id ?? GENERATED)) {
    return {
      id: content.sheet.id,
      name: content.sheet.name,
      markup: content.sheet.markup,
      canEdit: content.sheet.canEdit,
    };
  }
  if (chosen === GENERATED) {
    return {
      id: null,
      name: GENERATED_SHEET_NAME,
      markup: generateSheetMarkup(content.schemas),
      canEdit: false,
    };
  }
  const entry = typeSheets.value.find((sheetItem) => sheetItem.id === chosen);
  return entry
    ? { id: entry.id, name: entry.name, markup: entry.markup, canEdit: entry.canEdit }
    : undefined;
});
const sheetData = computed(() =>
  item.value ? { ...item.value.data, name: item.value.name } : {},
);

// Select values can't be empty strings (Reka UI), hence a sentinel.
const TYPE_DEFAULT = "type-default";
const isFormOpen = ref(false);
const form = reactive({
  slug: "",
  name: "",
  isPubliclyReadable: false,
  // Saved Sheet, or TYPE_DEFAULT for the ContentType's default.
  sheetId: TYPE_DEFAULT,
  data: "{}",
});
const savedSheetOptions = computed(() => [
  { label: "ContentType default", value: TYPE_DEFAULT },
  ...typeSheets.value.map((entry) => ({ label: entry.name, value: entry.id })),
]);
const formBusy = ref(false);
const formError = ref("");
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);

function openEdit() {
  if (!item.value) return;
  formError.value = "";
  form.slug = item.value.slug;
  form.name = item.value.name;
  form.isPubliclyReadable = item.value.isPubliclyReadable;
  form.sheetId = item.value.sheetId ?? TYPE_DEFAULT;
  form.data = JSON.stringify(item.value.data, null, 2);
  resetSlugTouched(true);
  isFormOpen.value = true;
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    const data = JSON.parse(form.data) as unknown;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error("Data must be a JSON object.");
    }
    await $fetch(`/api/content/${props.id}`, {
      method: "PATCH",
      body: {
        slug: form.slug,
        name: form.name,
        isPubliclyReadable: form.isPubliclyReadable,
        sheetId: form.sheetId === TYPE_DEFAULT ? null : form.sheetId,
        data,
      },
    });
    isFormOpen.value = false;
    viewSheetId.value = null;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(
      error,
      `Could not save ${props.label}.`,
    );
  } finally {
    formBusy.value = false;
  }
}

const isDeleteOpen = ref(false);
const deleteBusy = ref(false);
const deleteError = ref("");

async function remove() {
  deleteBusy.value = true;
  deleteError.value = "";

  try {
    await $fetch(`/api/content/${props.id}`, { method: "DELETE" });
    await navigateTo(props.listPath);
  } catch (error) {
    deleteError.value = extractApiErrorMessage(
      error,
      `Could not delete ${props.label}.`,
    );
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <UButton
      :to="listPath"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      size="sm"
    >
      Back to {{ listLabel }}
    </UButton>

    <template v-if="item">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-highlighted">{{ item.name }}</h1>
          <p class="text-sm text-muted">
            {{ item.slug }} ·
            {{ visibilityLabel(item.isPubliclyReadable) }} ·
            <NuxtLink
              v-if="contentType"
              :to="`/types/${contentType.id}`"
              class="hover:underline"
            >
              {{ contentType.name }}
            </NuxtLink>
            · Updated {{ new Date(item.updatedAt).toLocaleString() }}
          </p>
        </div>
        <div v-if="item.canEdit" class="flex gap-2">
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            @click="openEdit"
          >
            Edit
          </UButton>
          <UButton
            icon="i-lucide-trash"
            color="error"
            variant="outline"
            @click="
              deleteError = '';
              isDeleteOpen = true;
            "
          >
            Delete
          </UButton>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2 text-sm">
        <span class="text-muted">View with</span>
        <USelect
          :model-value="viewSheetId ?? item.sheet.id ?? GENERATED"
          :items="sheetOptions"
          class="w-56"
          aria-label="Sheet to view with"
          @update:model-value="viewSheetId = $event as string"
        />
        <UButton
          v-if="viewSheet?.id"
          :to="`/sheets/${viewSheet.id}`"
          icon="i-lucide-external-link"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Open Sheet"
        />
      </div>

      <SheetRenderer
        v-if="viewSheet"
        :key="viewSheet.id ?? GENERATED"
        :markup="viewSheet.markup"
        :schemas="item.schemas"
        :data="sheetData"
        :refs="item.refs"
        :can-edit-sheet="viewSheet.canEdit"
      />
    </template>

    <UModal v-model:open="isFormOpen" :title="`Edit ${label}`">
      <template #body>
        <UForm
          id="content-detail-form"
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
          <UFormField
            name="sheetId"
            label="Sheet"
            description="Used for everyone viewing this; they can still switch for themselves."
          >
            <USelect
              v-model="form.sheetId"
              :items="savedSheetOptions"
              class="w-full"
            />
          </UFormField>
          <UFormField
            name="data"
            label="Data (JSON)"
            description="Advanced: the raw data. The name is edited above."
            required
          >
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
          form="content-detail-form"
          label="Save"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      :title="`Delete ${label}`"
      :description="`Are you sure you want to delete &quot;${item?.name}&quot;? This action cannot be undone.`"
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
