<script setup lang="ts">
import { extractApiErrorMessage } from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

interface SheetDetail {
  id: string;
  slug: string;
  name: string;
  updatedAt: string;
  contentTypeId: string;
  markup: string;
  cssStyles: string;
  isDefault: boolean;
  canEdit: boolean;
}

interface ContentTypeOption {
  id: string;
  name: string;
  canEdit: boolean;
}

const route = useRoute();
const id = route.params.id as string;

const { data: sheet, refresh } = await useFetch<SheetDetail>(
  `/api/sheet/${id}`,
);

const { data: contentTypes } = await useLazyFetch<ContentTypeOption[]>(
  "/api/content-type",
  { default: () => [] },
);
const contentType = computed(() =>
  contentTypes.value.find((item) => item.id === sheet.value?.contentTypeId),
);
// Only editors of the ContentType may change its default Sheet.
const canSetDefault = computed(() => contentType.value?.canEdit ?? false);

const isFormOpen = ref(false);
const form = reactive({
  slug: "",
  name: "",
  isDefault: false,
  markup: "",
  cssStyles: "",
});
const formBusy = ref(false);
const formError = ref("");
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);

function openEdit() {
  if (!sheet.value) return;
  formError.value = "";
  form.slug = sheet.value.slug;
  form.name = sheet.value.name;
  form.isDefault = sheet.value.isDefault;
  form.markup = sheet.value.markup;
  form.cssStyles = sheet.value.cssStyles;
  resetSlugTouched(true);
  isFormOpen.value = true;
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    await $fetch(`/api/sheet/${id}`, {
      method: "PATCH",
      body: {
        slug: form.slug,
        name: form.name,
        markup: form.markup,
        cssStyles: form.cssStyles,
        ...(canSetDefault.value ? { isDefault: form.isDefault } : {}),
      },
    });
    isFormOpen.value = false;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not save Sheet.");
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
    await $fetch(`/api/sheet/${id}`, { method: "DELETE" });
    await navigateTo("/sheets");
  } catch (error) {
    deleteError.value = extractApiErrorMessage(
      error,
      "Could not delete Sheet.",
    );
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <UButton
      to="/sheets"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      size="sm"
    >
      Back to Sheets
    </UButton>

    <template v-if="sheet">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="flex items-center gap-2 text-2xl font-bold text-highlighted">
            {{ sheet.name }}
            <UBadge v-if="sheet.isDefault" variant="subtle">Default</UBadge>
          </h1>
          <p class="text-sm text-muted">
            {{ sheet.slug }} ·
            <NuxtLink
              v-if="contentType"
              :to="`/types/${contentType.id}`"
              class="hover:underline"
            >
              {{ contentType.name }}
            </NuxtLink>
            · Updated {{ new Date(sheet.updatedAt).toLocaleString() }}
          </p>
        </div>
        <div v-if="sheet.canEdit" class="flex gap-2">
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
          <h2 class="text-lg font-semibold text-highlighted">Markup</h2>
        </template>
        <pre
          v-if="sheet.markup"
          class="overflow-x-auto text-sm font-mono"
        >{{ sheet.markup }}</pre>
        <p v-else class="py-6 text-center text-sm text-muted">No markup yet.</p>
      </UPageCard>

      <UPageCard>
        <template #header>
          <h2 class="text-lg font-semibold text-highlighted">CSS</h2>
        </template>
        <pre
          v-if="sheet.cssStyles"
          class="overflow-x-auto text-sm font-mono"
        >{{ sheet.cssStyles }}</pre>
        <p v-else class="py-6 text-center text-sm text-muted">No CSS yet.</p>
      </UPageCard>
    </template>

    <UModal
      v-model:open="isFormOpen"
      title="Edit Sheet"
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body>
        <UForm
          id="sheet-detail-form"
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
            v-if="canSetDefault"
            name="isDefault"
            label="Default sheet"
            description="Used for Content of this type that doesn't pick a Sheet. Replaces any existing default."
          >
            <USwitch v-model="form.isDefault" />
          </UFormField>
          <UFormField name="markup" label="Markup">
            <UTextarea
              v-model="form.markup"
              class="w-full font-mono"
              :rows="12"
            />
          </UFormField>
          <UFormField name="cssStyles" label="CSS">
            <UTextarea
              v-model="form.cssStyles"
              class="w-full font-mono"
              :rows="6"
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
          form="sheet-detail-form"
          label="Save"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete Sheet"
      :description="`Are you sure you want to delete &quot;${sheet?.name}&quot;? This action cannot be undone.`"
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
