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
  isPubliclyReadable: boolean;
}

interface ContentTypeOption {
  id: string;
  name: string;
  canEdit: boolean;
}

const route = useRoute();
const id = route.params.id as string;

const { data: sheet } = await useFetch<SheetDetail>(
  `/api/sheet/${id}`,
);

const { data: contentTypes } = await useLazyFetch<ContentTypeOption[]>(
  "/api/content-type",
  { default: () => [] },
);
const contentType = computed(() =>
  contentTypes.value.find((item) => item.id === sheet.value?.contentTypeId),
);
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
            {{ visibilityLabel(sheet.isPubliclyReadable) }} ·
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
            :to="`/sheets/${id}/edit`"
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
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
