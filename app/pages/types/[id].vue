<script setup lang="ts">
import {
  extractApiErrorMessage,
  extractBrokenSheets,
  type BrokenSheets,
} from "~/utils/api-error";
import {
  CONTENT_CATEGORY_LABELS,
  type ContentCategory,
} from "#shared/content-categories";
import type { ContentTypeSchema } from "#shared/content-schema";
import {
  builderErrors,
  builderToSchema,
  parseSchemaJson,
  schemaToBuilder,
  type BuilderField,
} from "#shared/schema-builder";

definePageMeta({ middleware: "auth" });

interface ContentTypeDetail {
  id: string;
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

interface SystemOption {
  id: string;
  name: string;
}

interface SheetOption {
  id: string;
  name: string;
  readableId: string;
  contentTypeId: string;
  isDefault: boolean;
}

const categoryOptions = Object.entries(CONTENT_CATEGORY_LABELS).map(
  ([value, label]) => ({ label, value }),
);

const route = useRoute();
const id = route.params.id as string;
const toast = useToast();

const { data: contentType, refresh } = await useFetch<ContentTypeDetail>(
  `/api/content-type/${id}`,
);

const { data: systems } = await useLazyFetch<SystemOption[]>("/api/system", {
  default: () => [],
});
const system = computed(() =>
  systems.value.find((item) => item.id === contentType.value?.systemId),
);

const { data: sheets } = await useLazyFetch<SheetOption[]>("/api/sheet", {
  default: () => [],
});
const typeSheets = computed(() =>
  sheets.value.filter((item) => item.contentTypeId === id),
);

const isFormOpen = ref(false);
const form = reactive({
  readableId: "",
  name: "",
  isPubliclyReadable: false,
  contentCategory: "general" as ContentCategory,
  hasStrictSchema: false,
  ownerGroupId: null as string | null,
});
const formBusy = ref(false);
const formError = ref("");
const brokenSheets = ref<BrokenSheets>();
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(form);

function openEdit() {
  if (!contentType.value) return;
  formError.value = "";
  brokenSheets.value = undefined;
  form.readableId = contentType.value.readableId;
  form.name = contentType.value.name;
  form.isPubliclyReadable = contentType.value.isPubliclyReadable;
  form.ownerGroupId = contentType.value.ownerGroupId;
  form.contentCategory = contentType.value.contentCategory;
  form.hasStrictSchema = contentType.value.hasStrictSchema;
  resetReadableIdTouched(true);
  isFormOpen.value = true;
}

async function submitForm(confirmBrokenSheets = false) {
  formBusy.value = true;
  formError.value = "";
  brokenSheets.value = undefined;

  try {
    await $fetch(`/api/content-type/${id}`, {
      method: "PATCH",
      body: {
        readableId: form.readableId,
        name: form.name,
        isPubliclyReadable: form.isPubliclyReadable,
        ...(form.ownerGroupId !== (contentType.value?.ownerGroupId ?? null)
          ? { ownerGroupId: form.ownerGroupId }
          : {}),
        contentCategory: form.contentCategory,
        hasStrictSchema: form.hasStrictSchema,
        ...(confirmBrokenSheets ? { confirmBrokenSheets: true } : {}),
      },
    });
    isFormOpen.value = false;
    await refresh();
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

// Schema: edited with the schema builder, or as JSON (advanced).

const { data: allContentTypes } = await useLazyFetch<SystemOption[]>(
  "/api/content-type",
  { default: () => [] },
);

const schemaFields = ref<BuilderField[]>([]);
const schemaMode = ref<"builder" | "json">("builder");
const schemaJson = ref("");
const schemaBusy = ref(false);
const schemaError = ref("");
const schemaBroken = ref<BrokenSheets>();
// The saved schema, normalized the way the builder writes it, so an untouched
// draft compares equal.
const savedSchema = ref<string>();
function loadSchema(schema: ContentTypeSchema) {
  schemaFields.value = schemaToBuilder(schema);
  savedSchema.value = JSON.stringify(builderToSchema(schemaFields.value));
  schemaMode.value = "builder";
  schemaJson.value = "";
  schemaError.value = "";
  schemaBroken.value = undefined;
}

const schemaDraft = computed(() => {
  if (schemaMode.value === "builder")
    return { schema: builderToSchema(schemaFields.value) };
  return parseSchemaJson(schemaJson.value);
});
const schemaDirty = computed(
  () =>
    !!contentType.value?.canEdit &&
    savedSchema.value !== undefined &&
    (!("schema" in schemaDraft.value) ||
      JSON.stringify(schemaDraft.value.schema) !== savedSchema.value),
);
useUnsavedChangesGuard(schemaDirty);

watch(
  () => contentType.value?.schema,
  (schema) => {
    if (schema && !schemaDirty.value) loadSchema(schema as ContentTypeSchema);
  },
  { immediate: true },
);

const builderHasErrors = computed(
  () =>
    schemaMode.value === "builder" &&
    builderErrors(schemaFields.value).size > 0,
);

function setSchemaMode(mode: "builder" | "json") {
  if (mode === schemaMode.value) return;
  schemaError.value = "";
  if (mode === "json") {
    schemaJson.value = JSON.stringify(
      builderToSchema(schemaFields.value),
      null,
      2,
    );
    schemaMode.value = "json";
    return;
  }
  const parsed = parseSchemaJson(schemaJson.value);
  if ("error" in parsed) {
    schemaError.value = parsed.error;
    return;
  }
  schemaFields.value = schemaToBuilder(parsed.schema);
  schemaMode.value = "builder";
}

async function saveSchema(confirmBrokenSheets = false) {
  const draft = schemaDraft.value;
  if ("error" in draft) {
    schemaError.value = draft.error;
    return;
  }
  schemaBusy.value = true;
  schemaError.value = "";
  schemaBroken.value = undefined;
  try {
    await $fetch(`/api/content-type/${id}`, {
      method: "PATCH",
      body: {
        schema: draft.schema,
        ...(confirmBrokenSheets ? { confirmBrokenSheets: true } : {}),
      },
    });
    await refresh();
    if (contentType.value) loadSchema(contentType.value.schema as ContentTypeSchema);
    toast.add({ title: "Schema saved", color: "success", icon: "i-lucide-check" });
  } catch (error) {
    const broken = extractBrokenSheets(error);
    if (broken) schemaBroken.value = broken;
    else
      schemaError.value = extractApiErrorMessage(
        error,
        "Could not save the schema.",
      );
  } finally {
    schemaBusy.value = false;
  }
}

function discardSchema() {
  if (contentType.value) loadSchema(contentType.value.schema as ContentTypeSchema);
}

const isDeleteOpen = ref(false);
const deleteBusy = ref(false);
const deleteError = ref("");

async function remove() {
  deleteBusy.value = true;
  deleteError.value = "";

  try {
    await $fetch(`/api/content-type/${id}`, { method: "DELETE" });
    await navigateTo("/types");
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
    <UButton
      to="/types"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      size="sm"
    >
      Back to Content Types
    </UButton>

    <template v-if="contentType">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-highlighted">
            {{ contentType.name }}
          </h1>
          <p class="text-sm text-muted">
            {{ contentType.readableId }} ·
            {{ visibilityLabel(contentType.isPubliclyReadable) }} ·
            <NuxtLink
              v-if="system"
              :to="`/systems/${system.id}`"
              class="hover:underline"
            >
              {{ system.name }}
            </NuxtLink>
            · {{ CONTENT_CATEGORY_LABELS[contentType.contentCategory] }}
            <template v-if="contentType.hasStrictSchema">
              · Strict schema
            </template>
          </p>
        </div>
        <div v-if="contentType.canEdit" class="flex gap-2">
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

      <UPageCard>
        <template #header>
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-lg font-semibold text-highlighted">Sheets</h2>
            <UButton
              :to="{ path: '/sheets', query: { contentTypeId: id } }"
              icon="i-lucide-plus"
              size="sm"
            >
              New Sheet
            </UButton>
          </div>
        </template>

        <ul v-if="typeSheets.length" class="divide-y divide-default">
          <li
            v-for="item in typeSheets"
            :key="item.id"
            class="flex items-center justify-between gap-2 py-2"
          >
            <span class="flex items-center gap-2">
              <NuxtLink
                :to="`/sheets/${item.id}`"
                class="font-medium text-highlighted hover:underline"
              >
                {{ item.name }}
              </NuxtLink>
              <UBadge v-if="item.isDefault" variant="subtle" size="sm">
                Default
              </UBadge>
            </span>
            <span class="text-sm text-muted">{{ item.readableId }}</span>
          </li>
        </ul>
        <p v-else class="py-6 text-center text-sm text-muted">
          No sheets for this content type yet.
        </p>
      </UPageCard>

      <UPageCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 class="text-lg font-semibold text-highlighted">Schema</h2>
              <p class="text-sm text-muted">
                Every content type also has a built-in name field.
                <template v-if="contentType.canEdit">
                  Renaming a key doesn't move existing content's values to the
                  new key.
                </template>
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <UFieldGroup size="sm">
                <UButton
                  label="Builder"
                  :color="schemaMode === 'builder' ? 'primary' : 'neutral'"
                  :variant="schemaMode === 'builder' ? 'solid' : 'outline'"
                  @click="setSchemaMode('builder')"
                />
                <UButton
                  label="JSON"
                  :color="schemaMode === 'json' ? 'primary' : 'neutral'"
                  :variant="schemaMode === 'json' ? 'solid' : 'outline'"
                  @click="setSchemaMode('json')"
                />
              </UFieldGroup>
              <template v-if="contentType.canEdit">
                <UButton
                  label="Discard"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :disabled="!schemaDirty || schemaBusy"
                  @click="discardSchema"
                />
                <UButton
                  label="Save schema"
                  icon="i-lucide-save"
                  size="sm"
                  :loading="schemaBusy"
                  :disabled="!schemaDirty || builderHasErrors"
                  @click="saveSchema()"
                />
              </template>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <UAlert
            v-if="schemaError"
            color="error"
            variant="subtle"
            :description="schemaError"
          />
          <BrokenSheetsAlert
            v-if="schemaBroken"
            :broken="schemaBroken"
            :loading="schemaBusy"
            @confirm="saveSchema(true)"
          />
          <SchemaBuilder
            v-if="schemaMode === 'builder'"
            v-model="schemaFields"
            :content-types="allContentTypes"
            :readonly="!contentType.canEdit"
          />
          <ClientOnly v-else>
            <CodeEditor
              v-model="schemaJson"
              language="json"
              label="Schema JSON"
              :readonly="!contentType.canEdit"
              class="h-[60vh]"
            />
          </ClientOnly>
        </div>
      </UPageCard>
    </template>

    <UModal v-model:open="isFormOpen" title="Edit Content Type">
      <template #body>
        <UForm
          id="content-type-detail-form"
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
            v-if="contentType?.canChangeOwner"
            v-model="form.ownerGroupId"
            :original="contentType?.ownerGroupId ?? null"
          />
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
          form="content-type-detail-form"
          label="Save"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete Content Type"
      :description="`Are you sure you want to delete &quot;${contentType?.name}&quot;? This action cannot be undone.`"
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
