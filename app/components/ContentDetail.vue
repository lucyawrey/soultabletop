<script setup lang="ts">
import { extractApiErrorMessage } from "~/utils/api-error";

// Shared by /content/[id] and /characters/[id]: both are `content` Resources,
// differing only in their ContentType's category and where "back" goes.
const props = defineProps<{
  id: string;
  label: string;
  listPath: string;
  listLabel: string;
}>();

interface ContentDetail {
  id: string;
  slug: string;
  name: string;
  updatedAt: string;
  contentTypeId: string;
  sheetId: string | null;
  data: Record<string, unknown>;
  canEdit: boolean;
  isPubliclyReadable: boolean;
}

interface NamedItem {
  id: string;
  name: string;
}

const { data: item, refresh } = await useFetch<ContentDetail>(
  `/api/content/${props.id}`,
);

const { data: contentTypes } = await useLazyFetch<NamedItem[]>(
  "/api/content-type",
  { default: () => [] },
);
const { data: sheets } = await useLazyFetch<NamedItem[]>("/api/sheet", {
  default: () => [],
});

const contentType = computed(() =>
  contentTypes.value.find((type) => type.id === item.value?.contentTypeId),
);
const sheet = computed(() =>
  sheets.value.find((entry) => entry.id === item.value?.sheetId),
);

const isFormOpen = ref(false);
const form = reactive({
  slug: "",
  name: "",
  isPubliclyReadable: false,
  data: "{}",
});
const formBusy = ref(false);
const formError = ref("");
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);

function openEdit() {
  if (!item.value) return;
  formError.value = "";
  form.slug = item.value.slug;
  form.name = item.value.name;
  form.isPubliclyReadable = item.value.isPubliclyReadable;
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
        data,
      },
    });
    isFormOpen.value = false;
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
            <template v-if="sheet">
              ·
              <NuxtLink :to="`/sheets/${sheet.id}`" class="hover:underline">
                {{ sheet.name }} sheet
              </NuxtLink>
            </template>
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

      <UPageCard>
        <template #header>
          <h2 class="text-lg font-semibold text-highlighted">Data</h2>
        </template>
        <pre class="overflow-x-auto text-sm font-mono">{{
          JSON.stringify(item.data, null, 2)
        }}</pre>
      </UPageCard>
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
          <UFormField name="data" label="Data (JSON)" required>
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
