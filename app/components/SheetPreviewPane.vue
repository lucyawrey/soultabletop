<script setup lang="ts">
import { markupHasOwnPreview, type SheetPreviewTarget } from "#shared/sheet/card";
import type { SheetDisplay } from "#shared/sheet/registry";
import type { SheetLinks, SheetRefs } from "#shared/sheet/runtime";
import type { SheetSchemas } from "#shared/sheet/validate";

// The preview of a sheet on its page and in the Sheet editor: a heading with
// an Edit Fields switch (preview edits never save) and, when the markup has a
// `<Preview>` beside `<Sheet>`, a Sheet | Preview switch that shows it
// read-only, as a reference preview from another sheet would (`previewOf`).
// `#controls` adds to the heading's controls (the editor's data picker).
const props = defineProps<{
  markup: string;
  css?: string;
  scopeId: string;
  schemas: SheetSchemas;
  data: Record<string, unknown>;
  refs: SheetRefs;
  links: SheetLinks;
  contentTypeId: string;
  // The content shown, when it's real content rather than sample data.
  contentId?: string;
  canEditSheet?: boolean;
  defaultDisplay?: SheetDisplay;
  note: string;
}>();
const emit = defineEmits<{
  addRef: [id: string, ref: SheetRefs[string]];
  addLink: [id: string, link: SheetLinks[string]];
}>();

const editMode = ref(false);
const view = ref<"sheet" | "preview">("sheet");
const views = [
  { label: "Sheet", value: "sheet" },
  { label: "Preview", value: "preview" },
];
const hasOwnPreview = computed(() => markupHasOwnPreview(props.markup));
const previewOf = computed<SheetPreviewTarget | undefined>(() =>
  hasOwnPreview.value && view.value === "preview"
    ? {
        record: props.data,
        name: String(props.data.name ?? ""),
        contentTypeId: props.contentTypeId,
        id: props.contentId,
        // The renderer puts its root scope here.
        scope: { value: props.data, path: [] },
      }
    : undefined,
);
</script>

<template>
  <div class="min-w-0 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
      <h2 class="font-semibold text-highlighted">Preview</h2>
      <div class="flex flex-wrap items-center gap-3">
        <UTabs
          v-if="hasOwnPreview"
          v-model="view"
          :items="views"
          :content="false"
          size="xs"
          aria-label="Preview view"
        />
        <USwitch v-if="!previewOf" v-model="editMode" label="Edit Fields" />
        <slot name="controls" />
      </div>
    </div>
    <p class="text-xs text-muted">{{ note }}</p>
    <slot name="alerts" />
    <SheetRenderer
      :markup="markup"
      :css="css"
      :scope-id="scopeId"
      :schemas="schemas"
      :data="data"
      :refs="refs"
      :links="links"
      :can-edit-sheet="canEditSheet"
      can-edit
      :edit-mode="editMode"
      :default-display="defaultDisplay"
      :preview-of="previewOf"
      @add-ref="(refId, ref) => emit('addRef', refId, ref)"
      @add-link="(linkId, link) => emit('addLink', linkId, link)"
    />
  </div>
</template>
