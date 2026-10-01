<script setup lang="ts">
import { sampleSheetData } from "#shared/sheet/editor";
import type { SheetDisplay } from "#shared/sheet/registry";
import type { SheetLinks, SheetRefs } from "#shared/sheet/runtime";
import type { SheetSchemas } from "#shared/sheet/validate";
import { extractApiErrorMessage } from "~/utils/api-error";

interface SheetDetail {
  systemId: string;
  id: string;
  readableId: string;
  name: string;
  updatedAt: string;
  contentTypeId: string;
  markup: string;
  cssStyles: string;
  // cssStyles scoped for rendering.
  css: string;
  isDefault: boolean;
  defaultDisplay: SheetDisplay;
  canEdit: boolean;
  isPubliclyReadable: boolean;
  schemas: SheetSchemas;
}

interface ContentTypeOption {
  id: string;
  name: string;
  canEdit: boolean;
}

const route = useRoute();
const id = route.params.id as string;

const { followSystem } = useCurrentSystem();
const { data: sheet } = await useFetch<SheetDetail>(
  `/api/sheet/${id}`,
);
followSystem(sheet.value?.systemId);

// Logged-out visitors can view this if it's public; otherwise they're sent to
// sign in, since it may be something their account can see.
const loggedIn = await useLoggedIn();
if (!sheet.value && !loggedIn.value) {
  await navigateTo(signInRoute(route.fullPath), { replace: true });
}

const { data: contentTypes } = await useLazyFetch<ContentTypeOption[]>(
  "/api/content-type",
  { default: () => [] },
);
const contentType = computed(() =>
  contentTypes.value.find((item) => item.id === sheet.value?.contentTypeId),
);

// Preview against sample data, not tied to any content. Changes made in the
// preview are never saved.
const tab = ref("preview");
const tabs = [
  { label: "Preview", value: "preview", slot: "preview" as const },
  { label: "Markup", value: "markup", slot: "markup" as const },
  { label: "CSS", value: "css", slot: "css" as const },
];
const previewEditMode = ref(false);
const previewData = ref<Record<string, unknown>>({});
// Content and resources picked in the preview, so they show by name.
const previewRefs = ref<SheetRefs>({});
const previewLinks = ref<SheetLinks>({});
watch(
  () => sheet.value?.schemas,
  (schemas) => {
    previewData.value = schemas ? sampleSheetData(schemas) : {};
    previewRefs.value = {};
    previewLinks.value = {};
  },
  { immediate: true },
);
function addPreviewRef(refId: string, ref: SheetRefs[string]) {
  previewRefs.value = { ...previewRefs.value, [refId]: ref };
}
function addPreviewLink(linkId: string, link: SheetLinks[string]) {
  previewLinks.value = { ...previewLinks.value, [linkId]: link };
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
      "Could not delete sheet.",
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
            {{ sheet.readableId }} ·
            {{ visibilityLabel(sheet.isPubliclyReadable) }} ·
            <SystemLink :system-id="sheet.systemId" /> ·
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

      <UTabs v-model="tab" :items="tabs" :unmount-on-hide="false">
        <template #preview>
          <div class="space-y-4 pt-2">
            <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p class="text-muted">
                Shown with sample data. Changes made in the preview are never saved.
              </p>
              <USwitch v-model="previewEditMode" label="Edit" />
            </div>
            <SheetRenderer
              :markup="sheet.markup"
              :css="sheet.css"
              :scope-id="sheet.id"
              :schemas="sheet.schemas"
              :data="previewData"
              :refs="previewRefs"
              :links="previewLinks"
              :can-edit-sheet="sheet.canEdit"
              can-edit
              :edit-mode="previewEditMode"
              :default-display="sheet.defaultDisplay"
              @add-ref="addPreviewRef"
              @add-link="addPreviewLink"
            />
          </div>
        </template>

        <template #markup>
          <ClientOnly v-if="sheet.markup">
            <CodeEditor
              :model-value="sheet.markup"
              language="markup"
              label="Sheet markup"
              readonly
              class="h-[60vh]"
            />
            <template #fallback>
              <pre class="overflow-x-auto text-sm font-mono">{{ sheet.markup }}</pre>
            </template>
          </ClientOnly>
          <UCard v-else>
            <p class="py-6 text-center text-sm text-muted">No markup yet.</p>
          </UCard>
        </template>

        <template #css>
          <ClientOnly v-if="sheet.cssStyles">
            <CodeEditor
              :model-value="sheet.cssStyles"
              language="css"
              label="Sheet CSS"
              readonly
              class="h-[60vh]"
            />
            <template #fallback>
              <pre class="overflow-x-auto text-sm font-mono">{{ sheet.cssStyles }}</pre>
            </template>
          </ClientOnly>
          <UCard v-else>
            <p class="py-6 text-center text-sm text-muted">No CSS yet.</p>
          </UCard>
        </template>
      </UTabs>
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
