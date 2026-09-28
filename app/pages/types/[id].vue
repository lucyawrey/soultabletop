<script setup lang="ts">
import { extractApiErrorMessage } from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

type ContentCategory =
  "general" | "nonPlayerCharacter" | "document" | "playerCharacter";

interface ContentTypeDetail {
  id: string;
  slug: string;
  name: string;
  systemId: string;
  contentCategory: ContentCategory;
  hasStrictSchema: boolean;
  schema: Record<string, unknown>;
  canEdit: boolean;
}

interface SystemOption {
  id: string;
  name: string;
}

interface SheetOption {
  id: string;
  name: string;
  slug: string;
  contentTypeId: string;
  isDefault: boolean;
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

const route = useRoute();
const id = route.params.id as string;

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
  slug: "",
  name: "",
  contentCategory: "general" as ContentCategory,
  hasStrictSchema: false,
  schema: "{}",
});
const formBusy = ref(false);
const formError = ref("");
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);

function openEdit() {
  if (!contentType.value) return;
  formError.value = "";
  form.slug = contentType.value.slug;
  form.name = contentType.value.name;
  form.contentCategory = contentType.value.contentCategory;
  form.hasStrictSchema = contentType.value.hasStrictSchema;
  form.schema = JSON.stringify(contentType.value.schema, null, 2);
  resetSlugTouched(true);
  isFormOpen.value = true;
}

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
    await $fetch(`/api/content-type/${id}`, {
      method: "PATCH",
      body: {
        slug: form.slug,
        name: form.name,
        contentCategory: form.contentCategory,
        hasStrictSchema: form.hasStrictSchema,
        schema,
      },
    });
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
      "Could not delete Content Type. It may still be used by Content or Sheets.",
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
            {{ contentType.slug }} ·
            <NuxtLink
              v-if="system"
              :to="`/systems/${system.id}`"
              class="hover:underline"
            >
              {{ system.name }}
            </NuxtLink>
            · {{ categoryLabels[contentType.contentCategory] }}
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
            <span class="text-sm text-muted">{{ item.slug }}</span>
          </li>
        </ul>
        <p v-else class="py-6 text-center text-sm text-muted">
          No Sheets for this Content Type yet.
        </p>
      </UPageCard>

      <UPageCard>
        <template #header>
          <h2 class="text-lg font-semibold text-highlighted">Schema</h2>
        </template>
        <pre class="overflow-x-auto text-sm font-mono">{{
          JSON.stringify(contentType.schema, null, 2)
        }}</pre>
      </UPageCard>
    </template>

    <UModal v-model:open="isFormOpen" title="Edit Content Type">
      <template #body>
        <UForm
          id="content-type-detail-form"
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
