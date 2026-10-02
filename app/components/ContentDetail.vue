<script setup lang="ts">
import {
  GENERATED_SHEET_NAME,
  generatedSheetDefaults,
  generateSheetMarkup,
  type ContentCategory,
} from "#shared/sheet/generate";
import type { ResourceSource } from "#shared/resource-list";
import type { SheetDisplay } from "#shared/sheet/registry";
import type { SheetLinks, SheetRefs } from "#shared/sheet/runtime";
import type { SheetSchemas } from "#shared/sheet/validate";
import { extractApiErrorMessage } from "~/utils/api-error";

// Shared by /content/[id] and /characters/[id] (and their owner + readable ID
// routes): both are `content` Resources, differing only in their
// ContentType's category and where "back" goes.
const props = defineProps<{
  section: "content" | "characters";
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
  defaultDisplay: SheetDisplay;
  canEdit: boolean;
}

interface ContentDetail {
  systemId: string;
  id: string;
  readableId: string;
  ownerReadableId: string | null;
  name: string;
  updatedAt: string;
  contentTypeId: string;
  contentCategory: ContentCategory;
  sheetId: string | null;
  data: Record<string, unknown>;
  canEdit: boolean;
  ownerGroupId: string | null;
  canChangeOwner: boolean;
  isPubliclyReadable: boolean;
  sheet: ResolvedSheet;
  schemas: SheetSchemas;
  refs: SheetRefs;
  links: SheetLinks;
}

interface NamedItem {
  id: string;
  name: string;
}

interface SheetItem {
  id: string;
  name: string;
  source: ResourceSource;
  contentTypeId: string;
}

// `GET /api/sheet/[id]`, loaded when a Sheet is picked to view with (the list
// leaves out the markup and CSS).
interface SheetDetail {
  id: string;
  name: string;
  markup: string;
  css: string;
  defaultEditMode: boolean;
  defaultAutosave: boolean;
  defaultDisplay: SheetDisplay;
  canEdit: boolean;
}

const route = useRoute();
const { followSystem } = useCurrentSystem();
const { data: item, refresh } = await useResourceFetch<ContentDetail>("/api/content");
useReadableAddress(props.section, item);
followSystem(item.value?.systemId);

// Logged-out visitors can view this if it's public; otherwise they're sent to
// sign in, since it may be something their account can see.
const loggedIn = await useLoggedIn();
if (!item.value && !loggedIn.value) {
  await navigateTo(signInRoute(route.fullPath), { replace: true });
}

const { data: contentTypes, status: contentTypesStatus } = await useLazyFetch<NamedItem[]>(
  "/api/content-type",
  { default: () => [] },
);
const { data: sheets, status: sheetsStatus } = await useLazyFetch<SheetItem[]>("/api/sheet", {
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
  ...typeSheets.value.map((entry) =>
    resourceOption(entry.id, { name: entry.name, source: entry.source }),
  ),
]);
// The Sheet picked above, loaded in full (null while loading, or when the
// choice is the server's own or the generated one).
const pickedSheet = ref<SheetDetail | null>(null);
const toast = useToast();
watch(viewSheetId, async (chosen) => {
  pickedSheet.value = null;
  if (!chosen || chosen === GENERATED || chosen === item.value?.sheet.id) return;
  try {
    const detail = await $fetch<SheetDetail>(`/api/sheet/${chosen}`);
    if (viewSheetId.value === chosen) pickedSheet.value = detail;
  } catch (error) {
    if (viewSheetId.value !== chosen) return;
    viewSheetId.value = null;
    toast.add({
      title: extractApiErrorMessage(error, "Could not load sheet."),
      color: "error",
    });
  }
});
const viewSheet = computed(() => {
  const content = item.value;
  if (!content) return undefined;
  const chosen = viewSheetId.value;
  if (!chosen || chosen === (content.sheet.id ?? GENERATED)) return content.sheet;
  if (chosen === GENERATED) {
    return {
      id: null,
      name: GENERATED_SHEET_NAME,
      markup: generateSheetMarkup(content.schemas),
      canEdit: false,
      ...generatedSheetDefaults(content.contentCategory),
    };
  }
  // While the picked Sheet loads, the current one stays.
  return pickedSheet.value ?? content.sheet;
});

// Scoped CSS of the viewed Sheet (the server scopes it).
const viewCss = computed(() => {
  const current = viewSheet.value;
  if (!current || current === item.value?.sheet) return item.value?.sheet.css ?? "";
  return "css" in current ? current.css : "";
});

// Edit and Autosave switches start as the viewed Sheet says.
const editMode = ref(false);
const autosave = ref(false);
watch(
  () => viewSheet.value?.id ?? GENERATED,
  () => {
    editMode.value = viewSheet.value?.defaultEditMode ?? false;
    autosave.value = viewSheet.value?.defaultAutosave ?? false;
  },
  { immediate: true },
);

const {
  draft,
  dirty,
  status: saveStatus,
  error: saveError,
  save,
  discard,
  reset: resetDraft,
} = useContentDraft(item, autosave);

async function reload() {
  await refresh();
  resetDraft();
}

// Content picked in reference fields, shown before the next save reloads refs.
const pickedRefs = ref<SheetRefs>({});
const refs = computed(() => ({ ...item.value?.refs, ...pickedRefs.value }));
const pickedLinks = ref<SheetLinks>({});
const links = computed(() => ({ ...item.value?.links, ...pickedLinks.value }));
function addLink(id: string, link: SheetLinks[string]) {
  pickedLinks.value = { ...pickedLinks.value, [id]: link };
}
function addRef(id: string, ref: SheetRefs[string]) {
  pickedRefs.value = { ...pickedRefs.value, [id]: ref };
}

const statusText = computed(() => {
  if (saveStatus.value === "saving") return "Saving…";
  if (dirty.value) return autosave.value ? "Unsaved changes…" : "Unsaved changes";
  if (saveStatus.value === "saved") return "Saved";
  return "";
});

// Select values can't be empty strings (Reka UI), hence a sentinel.
const TYPE_DEFAULT = "type-default";
const isFormOpen = ref(false);
const form = reactive({
  readableId: "",
  name: "",
  isPubliclyReadable: false,
  // Saved Sheet, or TYPE_DEFAULT for the ContentType's default.
  sheetId: TYPE_DEFAULT,
  data: "{}",
  ownerGroupId: null as string | null,
});
const savedSheetOptions = computed(() => [
  { label: "Content Type default", value: TYPE_DEFAULT },
  ...typeSheets.value.map((entry) =>
    resourceOption(entry.id, { name: entry.name, source: entry.source }),
  ),
]);
const formBusy = ref(false);
const formError = ref("");
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(form);
const idAvailability = useResourceIdAvailability(form, "content", () => item.value ?? undefined);

function openEdit() {
  if (!item.value) return;
  formError.value = "";
  // Start from the draft so unsaved sheet edits aren't lost.
  const { name, ...data } = draft.value;
  form.readableId = item.value.readableId;
  form.name = typeof name === "string" ? name : item.value.name;
  form.isPubliclyReadable = item.value.isPubliclyReadable;
  form.ownerGroupId = item.value.ownerGroupId;
  form.sheetId = item.value.sheetId ?? TYPE_DEFAULT;
  form.data = JSON.stringify(data, null, 2);
  resetReadableIdTouched(true);
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
    await $fetch(`/api/content/${item.value!.id}`, {
      method: "PATCH",
      body: {
        readableId: form.readableId,
        name: form.name,
        isPubliclyReadable: form.isPubliclyReadable,
        ...(form.ownerGroupId !== (item.value?.ownerGroupId ?? null)
          ? { ownerGroupId: form.ownerGroupId }
          : {}),
        sheetId: form.sheetId === TYPE_DEFAULT ? null : form.sheetId,
        data,
      },
    });
    isFormOpen.value = false;
    viewSheetId.value = null;
    await reload();
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
    await $fetch(`/api/content/${item.value!.id}`, { method: "DELETE" });
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
          <h1 class="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-bold text-highlighted">
            {{ item.name }}
            <ReadableIdBadge :readable-id="item.readableId" />
          </h1>
          <p class="text-sm text-muted">
            {{ visibilityLabel(item.isPubliclyReadable) }} ·
            <SystemLink :system-id="item.systemId" /> ·
            <LookupSkeleton
              v-if="!contentType && isLoading(contentTypesStatus)"
            />
            <NuxtLink
              v-else-if="contentType"
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
            icon="i-lucide-settings"
            color="neutral"
            variant="outline"
            @click="openEdit"
          >
            Settings
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

      <div class="flex flex-wrap items-center justify-between gap-4 text-sm">
        <div v-if="item.canEdit" class="flex flex-wrap items-center gap-4">
          <USwitch v-model="editMode" label="Edit Fields" />
          <USwitch v-model="autosave" label="Autosave" />
          <span class="text-muted" aria-live="polite">{{ statusText }}</span>
        </div>
        <div class="ms-auto flex items-center gap-2">
          <span class="text-muted">View with</span>
          <LookupSkeleton
            v-if="isLoading(sheetsStatus)"
            size-class="h-8 w-56"
          />
          <USelect
            v-else
            :model-value="viewSheetId ?? item.sheet.id ?? GENERATED"
            :items="sheetOptions"
            class="w-56"
            aria-label="Sheet to view with"
            @update:model-value="viewSheetId = $event as string"
          >
            <template #item-label="{ item: option }">
              <ResourceOption :option="option as ResourceOptionItem" />
            </template>
          </USelect>
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
      </div>

      <SheetRenderer
        v-if="viewSheet"
        :key="viewSheet.id ?? GENERATED"
        :markup="viewSheet.markup"
        :css="viewCss"
        :scope-id="viewSheet.id"
        :schemas="item.schemas"
        :data="draft"
        :refs="refs"
        :links="links"
        :can-edit-sheet="viewSheet.canEdit"
        :can-edit="item.canEdit"
        :edit-mode="editMode"
        :default-display="viewSheet.defaultDisplay"
        @add-ref="addRef"
        @add-link="addLink"
      />

      <div
        v-if="
          item.canEdit &&
          ((dirty && !autosave) ||
            saveStatus === 'error' ||
            saveStatus === 'conflict')
        "
        class="sticky bottom-[env(safe-area-inset-bottom,0px)] z-10"
      >
        <UAlert
          v-if="saveStatus === 'conflict'"
          color="warning"
          variant="solid"
          icon="i-lucide-triangle-alert"
          title="Someone else changed this since you loaded it"
          description="Reload to see their changes (yours are discarded), or overwrite them with yours."
          :actions="[
            { label: 'Reload', color: 'neutral', variant: 'subtle', onClick: reload },
            { label: 'Overwrite', color: 'neutral', variant: 'outline', onClick: () => save(true) },
          ]"
        />
        <UAlert
          v-else
          :color="saveStatus === 'error' ? 'error' : 'neutral'"
          variant="solid"
          :icon="saveStatus === 'error' ? 'i-lucide-circle-alert' : 'i-lucide-pencil'"
          :title="saveStatus === 'error' ? 'Could not save' : 'Unsaved changes'"
          :description="saveStatus === 'error' ? saveError : undefined"
          :actions="[
            ...(autosave
              ? []
              : [{ label: 'Save', color: 'primary' as const, loading: saveStatus === 'saving', onClick: () => save() }]),
            { label: 'Discard', color: 'neutral', variant: 'subtle', onClick: discard },
          ]"
        />
      </div>
    </template>

    <UModal v-model:open="isFormOpen" :title="`${label} settings`">
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
          <ReadableIdField
            :model-value="form.readableId"
            :availability="idAvailability"
            :error="readableIdError"
            @update:model-value="onReadableIdInput"
          />
          <VisibilityField v-model="form.isPubliclyReadable" />
          <OwnerField
            v-if="item?.canChangeOwner"
            v-model="form.ownerGroupId"
            :original="item?.ownerGroupId ?? null"
          />
          <UFormField
            name="sheetId"
            label="Sheet"
            description="Used for everyone viewing this; they can still switch for themselves."
          >
            <USelect
              v-model="form.sheetId"
              :items="savedSheetOptions"
              class="w-full"
            >
              <template #item-label="{ item: option }">
                <ResourceOption :option="option as ResourceOptionItem" />
              </template>
            </USelect>
          </UFormField>
          <UFormField
            name="data"
            label="Data (JSON)"
            description="Advanced: the raw data. The name is edited above."
            required
          >
            <ClientOnly>
              <CodeEditor
                v-model="form.data"
                language="json"
                label="Data JSON"
                class="h-80"
              />
            </ClientOnly>
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
