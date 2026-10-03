<script setup lang="ts">
import type { SheetCssResult } from "#shared/sheet/css";
import { sampleSheetData, sheetFieldPaths } from "#shared/sheet/editor";
import {
  readSheetFile,
  sheetExportFileName,
  sheetFileTypes,
  type SheetFileKind,
} from "#shared/sheet/files";
import { siteFonts } from "#shared/fonts";
import { sheetThemeTokens } from "#shared/sheet/theme-tokens";
import { generateSheetMarkup, type ContentCategory } from "#shared/sheet/generate";
import type { SheetDiagnostic } from "#shared/sheet/parser";
import {
  commonAttrs,
  sheetTags,
  type SheetDisplay,
  type TagSpec,
} from "#shared/sheet/registry";
import type { SheetLinks, SheetRefs } from "#shared/sheet/runtime";
import { compileSheet, type SheetSchemas } from "#shared/sheet/validate";
import {
  extractApiErrorMessage,
  extractDefaultReplacement,
} from "~/utils/api-error";

// Full-page Sheet editor: markup and CSS with inline diagnostics, settings,
// and a live preview. See docs/sheet-system.md, section 7.
definePageMeta({ middleware: "auth" });

interface SheetDetail {
  systemId: string;
  id: string;
  readableId: string;
  ownerReadableId: string | null;
  name: string;
  contentTypeId: string;
  contentCategory: ContentCategory;
  markup: string;
  cssStyles: string;
  isDefault: boolean;
  defaultEditMode: boolean;
  defaultAutosave: boolean;
  defaultDisplay: SheetDisplay;
  canEdit: boolean;
  ownerGroupId: string | null;
  canChangeOwner: boolean;
  isPubliclyReadable: boolean;
  schemas: SheetSchemas;
}

interface ContentTypeOption {
  id: string;
  name: string;
  canEdit: boolean;
}

interface ContentOption {
  id: string;
  name: string;
}

interface ContentDetail {
  name: string;
  data: Record<string, unknown>;
  refs: SheetRefs;
  links: SheetLinks;
}

const toast = useToast();

const { followSystem } = useCurrentSystem();
const { data: sheet, refresh: refreshSheet } = await useResourceFetch<SheetDetail>("/api/sheet");
useReadableAddress("sheets", sheet, "/edit");
// The route may address the sheet by owner + readable ID; changes go by ID.
const id = computed(() => sheet.value?.id ?? "");
followSystem(sheet.value?.systemId);
if (sheet.value && !sheet.value.canEdit) await navigateTo(`/sheets/${id.value}`);

const { data: contentTypes } = await useLazyFetch<ContentTypeOption[]>(
  "/api/content-type",
  { default: () => [] },
);
const contentType = computed(() =>
  contentTypes.value.find((item) => item.id === sheet.value?.contentTypeId),
);
// Only editors of the ContentType may change its default Sheet.
const canSetDefault = computed(() => contentType.value?.canEdit ?? false);

// Form

const form = reactive({
  name: "",
  readableId: "",
  isPubliclyReadable: false,
  ownerGroupId: null as string | null,
  isDefault: false,
  defaultEditMode: false,
  defaultAutosave: false,
  defaultDisplay: "text" as SheetDisplay,
  markup: "",
  cssStyles: "",
});
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(form);
const idAvailability = useResourceIdAvailability(form, "sheet", () => sheet.value ?? undefined);
const displayOptions = [
  { label: "Text", value: "text", description: "Plain values, like a stat block." },
  { label: "Box", value: "box", description: "Their input boxes, disabled, as when Edit Fields is on." },
];
const saved = ref("");
function load(detail: SheetDetail) {
  Object.assign(form, {
    name: detail.name,
    readableId: detail.readableId,
    isPubliclyReadable: detail.isPubliclyReadable,
    ownerGroupId: detail.ownerGroupId,
    isDefault: detail.isDefault,
    defaultEditMode: detail.defaultEditMode,
    defaultAutosave: detail.defaultAutosave,
    defaultDisplay: detail.defaultDisplay,
    markup: detail.markup,
    cssStyles: detail.cssStyles,
  });
  resetReadableIdTouched(true);
  saved.value = JSON.stringify(form);
}
if (sheet.value) load(sheet.value);

const dirty = computed(() => JSON.stringify(form) !== saved.value);
useUnsavedChangesGuard(dirty);

const saving = ref(false);
const saveError = ref("");
// Set when saving as the default would replace another default Sheet.
const replaceDefault = ref<string>();
watch(
  () => form.isDefault,
  () => (replaceDefault.value = undefined),
);
async function save(confirmReplaceDefault = false) {
  if (saving.value) return;
  saving.value = true;
  saveError.value = "";
  replaceDefault.value = undefined;
  const snapshot = JSON.stringify(form);
  const ownerChanged = form.ownerGroupId !== (sheet.value?.ownerGroupId ?? null);
  try {
    await $fetch(`/api/sheet/${id.value}`, {
      method: "PATCH",
      body: {
        name: form.name,
        readableId: form.readableId,
        isPubliclyReadable: form.isPubliclyReadable,
        ...(ownerChanged ? { ownerGroupId: form.ownerGroupId } : {}),
        markup: form.markup,
        cssStyles: form.cssStyles,
        defaultEditMode: form.defaultEditMode,
        defaultAutosave: form.defaultAutosave,
        defaultDisplay: form.defaultDisplay,
        ...(canSetDefault.value ? { isDefault: form.isDefault } : {}),
        ...(confirmReplaceDefault ? { confirmReplaceDefault: true } : {}),
      },
    });
    saved.value = snapshot;
    // The owner and who may change it again come from the server.
    if (ownerChanged) await refreshSheet();
    toast.add({ title: "Sheet saved", color: "success", icon: "i-lucide-check" });
  } catch (error) {
    replaceDefault.value = extractDefaultReplacement(error);
    if (!replaceDefault.value)
      saveError.value = extractApiErrorMessage(error, "Could not save sheet.");
  } finally {
    saving.value = false;
  }
}

defineShortcuts({ meta_s: { usingInput: true, handler: () => save() } });

// Diagnostics, recomputed shortly after typing stops.

function debounced(source: () => string, delay = 200) {
  const value = ref(source());
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(source, (next) => {
    clearTimeout(timer);
    timer = setTimeout(() => (value.value = next), delay);
  });
  onBeforeUnmount(() => clearTimeout(timer));
  return value;
}
const markup = debounced(() => form.markup);
const css = debounced(() => form.cssStyles);

const compiled = computed(() =>
  sheet.value ? compileSheet(markup.value, sheet.value.schemas) : undefined,
);
const cssResult = ref<SheetCssResult>({ css: "", diagnostics: [] });
watch(
  css,
  async (value) => {
    // postcss only loads on this page, on the client.
    if (import.meta.server) return;
    const { processSheetCss } = await import("#shared/sheet/css");
    cssResult.value = processSheetCss(value, id.value);
  },
  { immediate: true },
);

const markupDiagnostics = computed(() => compiled.value?.diagnostics ?? []);
const cssDiagnostics = computed(() => cssResult.value.diagnostics);
const errorCount = computed(
  () =>
    [...markupDiagnostics.value, ...cssDiagnostics.value].filter(
      (item) => item.severity === "error",
    ).length,
);

// Editors and tabs

const tab = ref("markup");
const tabs = [
  { label: "Markup", value: "markup", slot: "markup" as const },
  { label: "CSS", value: "css", slot: "css" as const },
  { label: "Settings", value: "settings", slot: "settings" as const },
];
const markupEditor = ref<{ goTo: (position: SheetDiagnostic["loc"]["start"]) => void; insert: (text: string) => void }>();
const cssEditor = ref<{ goTo: (position: SheetDiagnostic["loc"]["start"]) => void }>();

async function goTo(where: "markup" | "css", diagnostic: SheetDiagnostic) {
  tab.value = where;
  await nextTick();
  (where === "markup" ? markupEditor : cssEditor).value?.goTo(diagnostic.loc.start);
}

const fieldPaths = computed(() =>
  sheet.value ? sheetFieldPaths(sheet.value.schemas) : [],
);

// Files: load markup or CSS from a local file as an unsaved change (Upload, or
// drop it on the editor), and download what's in the editor.

const fileInput = ref<HTMLInputElement>();
const fileKind = ref<SheetFileKind>("markup");
const fileError = ref("");
function pickFile(kind: SheetFileKind) {
  if (!fileInput.value) return;
  fileKind.value = kind;
  fileInput.value.accept = sheetFileTypes[kind].extensions.join(",");
  fileInput.value.click();
}
async function loadFile(file: File, kind: SheetFileKind) {
  fileError.value = "";
  const result = await readSheetFile(file, kind);
  if ("error" in result) {
    fileError.value = result.error;
    return;
  }
  if (kind === "markup") form.markup = result.text;
  else form.cssStyles = result.text;
  tab.value = kind;
  toast.add({
    title: `Loaded ${file.name}`,
    description: "Not saved yet. Undo in the editor to go back.",
    color: "info",
    icon: "i-lucide-file-up",
  });
}
function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) loadFile(file, fileKind.value);
}
// Caught before CodeMirror, which would insert a dropped file at the cursor.
function isFileDrag(event: DragEvent) {
  return event.dataTransfer?.types.includes("Files") ?? false;
}
function onFileDragOver(event: DragEvent) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer!.dropEffect = "copy";
}
function onFileDrop(event: DragEvent, kind: SheetFileKind) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  event.stopPropagation();
  const file = event.dataTransfer!.files[0];
  if (file) loadFile(file, kind);
}
function download(kind: SheetFileKind) {
  const text = kind === "markup" ? form.markup : form.cssStyles;
  const blob = new Blob([text], { type: `${sheetFileTypes[kind].mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = sheetExportFileName(form.readableId, kind);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}

// "Insert generated markup"

const isGenerateOpen = ref(false);
function insertGenerated() {
  if (sheet.value) form.markup = generateSheetMarkup(sheet.value.schemas);
  isGenerateOpen.value = false;
  tab.value = "markup";
}

// Preview

const SAMPLE = "sample";
const previewSource = ref(SAMPLE);
const previewEditMode = ref(false);
const { data: contents } = await useLazyFetch<ContentOption[]>("/api/content", {
  query: computed(() => ({ contentTypeId: sheet.value?.contentTypeId })),
  default: () => [],
});
const previewOptions = computed(() => [
  { label: "Sample data", value: SAMPLE },
  ...contents.value.map((item) => ({ label: item.name, value: item.id })),
]);
const previewData = ref<Record<string, unknown>>({});
const previewRefs = ref<SheetRefs>({});
const previewLinks = ref<SheetLinks>({});
const previewError = ref("");
watch(
  previewSource,
  async (source) => {
    previewError.value = "";
    if (!sheet.value) return;
    if (source === SAMPLE) {
      previewData.value = sampleSheetData(sheet.value.schemas);
      previewRefs.value = {};
      previewLinks.value = {};
      return;
    }
    try {
      const detail = await $fetch<ContentDetail>(`/api/content/${source}`);
      previewData.value = structuredClone({ ...detail.data, name: detail.name });
      previewRefs.value = detail.refs;
      previewLinks.value = detail.links;
    } catch (error) {
      previewError.value = extractApiErrorMessage(error, "Could not load content.");
    }
  },
  { immediate: true },
);
function addPreviewRef(refId: string, ref: SheetRefs[string]) {
  previewRefs.value = { ...previewRefs.value, [refId]: ref };
}
function addPreviewLink(linkId: string, link: SheetLinks[string]) {
  previewLinks.value = { ...previewLinks.value, [linkId]: link };
}

// Reference panel

const isReferenceOpen = ref(false);
const tagGroups = computed(() => {
  const groups: Record<TagSpec["category"], TagSpec[]> = {
    layout: [],
    field: [],
    repeater: [],
    definition: [],
  };
  for (const spec of sheetTags.values()) groups[spec.category].push(spec);
  return [
    { title: "Layout", tags: groups.layout },
    { title: "Fields", tags: groups.field },
    { title: "Repeaters", tags: groups.repeater },
    { title: "Definitions", tags: groups.definition },
  ];
});
function attrType(spec: TagSpec["attrs"][string]) {
  const { type } = spec;
  if (type.kind === "enum") return type.values.join(" | ");
  if (type.kind === "field") return "field path";
  if (type.kind === "number" && type.min !== undefined && type.max !== undefined)
    return `number ${type.min}–${type.max}`;
  return type.kind;
}
async function insertPath(path: string) {
  isReferenceOpen.value = false;
  tab.value = "markup";
  await nextTick();
  markupEditor.value?.insert(path);
}
</script>

<template>
  <PageContainer compact>
    <UButton
      :to="`/sheets/${id}`"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      size="sm"
    >
      Back to Sheet
    </UButton>

    <template v-if="sheet">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-highlighted">
            Edit {{ sheet.name }}
          </h1>
          <p class="text-sm text-muted">
            <SystemLink :system-id="sheet.systemId" /> ·
            <NuxtLink
              v-if="contentType"
              :to="`/types/${contentType.id}`"
              class="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            >
              {{ contentType.name }}
            </NuxtLink>
            <template v-if="dirty"> · Unsaved changes</template>
            <template v-if="errorCount">
              · {{ errorCount }} error{{ errorCount === 1 ? "" : "s" }}
            </template>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-book-open"
            color="neutral"
            variant="outline"
            label="Reference"
            @click="isReferenceOpen = true"
          />
          <UButton
            icon="i-lucide-wand-sparkles"
            color="neutral"
            variant="outline"
            label="Insert generated markup"
            @click="isGenerateOpen = true"
          />
          <UButton
            icon="i-lucide-save"
            label="Save"
            :loading="saving"
            :disabled="!dirty"
            @click="save()"
          >
            <template #trailing>
              <UKbd value="meta" size="sm" /><UKbd value="s" size="sm" />
            </template>
          </UButton>
        </div>
      </div>

      <UAlert
        v-if="saveError"
        color="error"
        variant="subtle"
        title="Could not save"
        :description="saveError"
      />
      <UAlert
        v-if="fileError"
        color="error"
        variant="subtle"
        title="Could not load file"
        :description="fileError"
        :close="true"
        @update:open="fileError = ''"
      />
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        aria-hidden="true"
        @change="onFileChosen"
      />
      <ReplaceDefaultSheetAlert
        v-if="replaceDefault"
        :message="replaceDefault"
        :loading="saving"
        @confirm="save(true)"
      />

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="min-w-0 space-y-4">
          <UTabs v-model="tab" :items="tabs" :unmount-on-hide="false">
            <template #markup>
              <div class="flex flex-wrap items-center justify-end gap-2 pb-2">
                <span class="text-xs text-muted">Drop a file on the editor to load it.</span>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-upload"
                  label="Upload"
                  @click="pickFile('markup')"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-download"
                  label="Download"
                  @click="download('markup')"
                />
              </div>
              <div
                @dragover.capture="onFileDragOver"
                @drop.capture="onFileDrop($event, 'markup')"
              >
                <ClientOnly>
                  <CodeEditor
                    ref="markupEditor"
                    v-model="form.markup"
                    language="markup"
                    label="Sheet markup"
                    :diagnostics="markupDiagnostics"
                    :field-paths="fieldPaths.map((item) => item.path)"
                    class="h-[60vh]"
                  />
                </ClientOnly>
              </div>
            </template>
            <template #css>
              <div class="flex flex-wrap items-center justify-end gap-2 pb-2">
                <span class="text-xs text-muted">Drop a file on the editor to load it.</span>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-upload"
                  label="Upload"
                  @click="pickFile('css')"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-download"
                  label="Download"
                  @click="download('css')"
                />
              </div>
              <div
                @dragover.capture="onFileDragOver"
                @drop.capture="onFileDrop($event, 'css')"
              >
                <ClientOnly>
                  <CodeEditor
                    ref="cssEditor"
                    v-model="form.cssStyles"
                    language="css"
                    label="Sheet CSS"
                    :diagnostics="cssDiagnostics"
                    class="h-[60vh]"
                  />
                </ClientOnly>
              </div>
            </template>
            <template #settings>
              <div class="space-y-4 pt-2">
                <UFormField name="name" label="Name" required>
                  <UInput v-model="form.name" class="w-full" />
                </UFormField>
                <ReadableIdField
                  :model-value="form.readableId"
                  :availability="idAvailability"
                  :error="readableIdError"
                  @update:model-value="onReadableIdInput"
                />
                <VisibilityField v-model="form.isPubliclyReadable" />
                <OwnerField
                  v-if="sheet?.canChangeOwner"
                  v-model="form.ownerGroupId"
                  :original="sheet?.ownerGroupId ?? null"
                />
                <UFormField
                  v-if="canSetDefault"
                  name="isDefault"
                  label="Default sheet"
                  description="Used for content of this type that doesn't pick a sheet. You'll be asked before it replaces another default."
                >
                  <USwitch v-model="form.isDefault" />
                </UFormField>
                <UFormField
                  name="defaultEditMode"
                  label="Start with Edit Fields on"
                  description="Whether content opens with the Edit Fields switch on."
                >
                  <USwitch v-model="form.defaultEditMode" />
                </UFormField>
                <UFormField
                  name="defaultAutosave"
                  label="Start with Autosave on"
                  description="Whether edits save automatically without a Save button."
                >
                  <USwitch v-model="form.defaultAutosave" />
                </UFormField>
                <UFormField
                  name="defaultDisplay"
                  label="Non-editable fields"
                  description="How fields look when they can't be edited. Markup can override this with display=&quot;text&quot; or display=&quot;box&quot;."
                >
                  <URadioGroup
                    v-model="form.defaultDisplay"
                    :items="displayOptions"
                  />
                </UFormField>
              </div>
            </template>
          </UTabs>

          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <h2 class="text-sm font-semibold text-highlighted">
                Problems
              </h2>
            </template>
            <ul
              v-if="markupDiagnostics.length || cssDiagnostics.length"
              class="max-h-60 divide-y divide-default overflow-y-auto text-sm"
            >
              <li
                v-for="(item, index) in [
                  ...markupDiagnostics.map((diagnostic) => ({ where: 'markup' as const, diagnostic })),
                  ...cssDiagnostics.map((diagnostic) => ({ where: 'css' as const, diagnostic })),
                ]"
                :key="index"
              >
                <button
                  type="button"
                  class="flex w-full items-start gap-2 px-4 py-2 text-left hover:bg-elevated"
                  @click="goTo(item.where, item.diagnostic)"
                >
                  <UIcon
                    :name="item.diagnostic.severity === 'error' ? 'i-lucide-circle-x' : 'i-lucide-triangle-alert'"
                    :class="item.diagnostic.severity === 'error' ? 'text-error' : 'text-warning'"
                    class="mt-0.5 size-4 shrink-0"
                  />
                  <span class="flex-1">{{ item.diagnostic.message }}</span>
                  <span class="shrink-0 text-xs text-muted">
                    {{ item.where === "css" ? "CSS" : "Markup" }}
                    {{ item.diagnostic.loc.start.line }}:{{ item.diagnostic.loc.start.column }}
                  </span>
                </button>
              </li>
            </ul>
            <p v-else class="px-4 py-3 text-sm text-muted">No problems.</p>
          </UCard>
        </div>

        <div class="min-w-0 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
            <h2 class="font-semibold text-highlighted">Preview</h2>
            <div class="flex flex-wrap items-center gap-3">
              <USwitch v-model="previewEditMode" label="Edit Fields" />
              <USelect
                v-model="previewSource"
                :items="previewOptions"
                class="w-48"
                aria-label="Preview data"
              />
            </div>
          </div>
          <p class="text-xs text-muted">
            Changes made in the preview are never saved.
          </p>
          <UAlert
            v-if="previewError"
            color="error"
            variant="subtle"
            :description="previewError"
          />
          <SheetRenderer
            :markup="markup"
            :css="cssResult.css"
            :scope-id="id"
            :schemas="sheet.schemas"
            :data="previewData"
            :refs="previewRefs"
            :links="previewLinks"
            can-edit-sheet
            can-edit
            :edit-mode="previewEditMode"
            :default-display="form.defaultDisplay"
            @add-ref="addPreviewRef"
            @add-link="addPreviewLink"
          />
        </div>
      </div>
    </template>

    <UModal
      v-model:open="isGenerateOpen"
      title="Insert generated markup"
      description="Replace the markup with markup generated from the content type's schema? You can undo this in the editor, or leave without saving."
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer="{ close }">
        <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
        <UButton label="Replace markup" @click="insertGenerated" />
      </template>
    </UModal>

    <USlideover
      v-model:open="isReferenceOpen"
      title="Sheet reference"
      :ui="{ content: 'max-w-xl' }"
    >
      <template #body>
        <div class="space-y-8 text-sm">
          <section class="space-y-2">
            <h3 class="font-semibold text-highlighted">Fields of this Content Type</h3>
            <p class="text-muted">
              Click to insert at the cursor. Inside a List, paths are relative to
              the item (<code>name</code> for <code>attacks[].name</code>); start
              with <code>/</code> for the top level. Use <code>{path}</code> in
              text.
            </p>
            <ul class="divide-y divide-default rounded-md border border-default">
              <li v-for="item in fieldPaths" :key="item.path">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-elevated"
                  @click="insertPath(item.path.split('[].').at(-1)!)"
                >
                  <code class="text-highlighted">{{ item.path }}</code>
                  <span class="ms-auto text-xs text-muted">{{ item.type }}</span>
                </button>
              </li>
            </ul>
          </section>

          <section v-for="group in tagGroups" :key="group.title" class="space-y-3">
            <h3 class="font-semibold text-highlighted">{{ group.title }}</h3>
            <div v-for="spec in group.tags" :key="spec.name" class="space-y-1">
              <div>
                <code class="font-semibold text-primary">&lt;{{ spec.name }}&gt;</code>
                <span class="text-muted"> — {{ spec.description }}</span>
              </div>
              <ul v-if="Object.keys(spec.attrs).length" class="ps-4 text-xs">
                <li v-for="(attr, name) in spec.attrs" :key="name">
                  <code>{{ name }}</code><span v-if="attr.required" class="text-error">*</span>
                  <span class="text-dimmed"> ({{ attrType(attr) }})</span>
                  <span class="text-muted"> {{ attr.description }}</span>
                </li>
              </ul>
            </div>
            <p v-if="group.title === 'Layout'" class="text-xs text-muted">
              Every tag also accepts
              <code v-for="name in Object.keys(commonAttrs)" :key="name" class="me-1">{{ name }}</code>
              (<code>Tab</code> and <code>RowDetails</code> only <code>class</code>).
            </p>
          </section>

          <section class="space-y-2">
            <h3 class="font-semibold text-highlighted">CSS</h3>
            <p class="text-muted">
              Rules only apply inside this sheet. Target tags with their
              <code>sheet-&lt;tag&gt;</code> class (e.g. <code>.sheet-section</code>)
              or your own <code>class="…"</code>. <code>:root</code> means the
              Sheet itself, and <code>@media print</code> styles the printed
              page. Files can't be loaded (no <code>url()</code> or
              <code>@import</code>).
            </p>
            <h4 class="font-medium text-highlighted">Fonts</h4>
            <ul class="space-y-1">
              <li v-for="font in siteFonts" :key="font.name">
                <span :style="{ fontFamily: `'${font.name}'` }" class="text-base">{{ font.name }}</span>
                <span class="text-xs text-muted"> — {{ font.description }}</span>
              </li>
            </ul>
            <h4 class="font-medium text-highlighted">Theme tokens</h4>
            <ul class="space-y-1">
              <li v-for="token in sheetThemeTokens" :key="token.name">
                <code class="text-xs">var({{ token.name }})</code>
                <span class="text-xs text-muted"> — {{ token.description }}</span>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </USlideover>
  </PageContainer>
</template>
