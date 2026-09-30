<script setup lang="ts">
import {
  setSheetValue,
  type SheetLinks,
  type SheetRefs,
} from "#shared/sheet/runtime";
import type { SheetDisplay } from "#shared/sheet/registry";
import { compileSheet, type SheetSchemas } from "#shared/sheet/validate";

// Renders Content with Sheet markup, for viewing and editing. See
// docs/sheet-system.md, section 5.
const props = defineProps<{
  markup: string;
  schemas: SheetSchemas;
  // Content data including the built-in `name`. Edited in place when editing,
  // so pass the draft copy.
  data: Record<string, unknown>;
  refs: SheetRefs;
  links?: SheetLinks;
  // The Sheet's CSS, already scoped to `[data-sheet="<scopeId>"]` (see
  // shared/sheet/css.ts).
  css?: string;
  scopeId?: string | null;
  // Show placeholders for broken tags (users who can edit the Sheet).
  canEditSheet?: boolean;
  // The viewer may edit the Content.
  canEdit?: boolean;
  // The Edit switch.
  editMode?: boolean;
  // How fields look when they can't be edited, unless the markup's `display`
  // says otherwise (the Sheet's setting).
  defaultDisplay?: SheetDisplay;
}>();

useHead({
  style: computed(() =>
    props.css && props.scopeId
      ? [{ key: `sheet-css-${props.scopeId}`, textContent: props.css }]
      : [],
  ),
});

const emit = defineEmits<{
  // Content picked in a reference field, to keep for display.
  addRef: [id: string, ref: SheetRefs[string]];
  // A resource picked in a resourceLink field, to keep for display.
  addLink: [id: string, link: SheetLinks[string]];
}>();

const compiled = computed(() => compileSheet(props.markup, props.schemas));

provideSheetContext({
  root: computed(() => ({ value: props.data, path: [] })),
  refs: computed(() => props.refs),
  links: computed(() => props.links ?? {}),
  schemas: computed(() => props.schemas),
  showInvalid: computed(() => props.canEditSheet ?? false),
  canEdit: computed(() => props.canEdit ?? false),
  editMode: computed(() => props.editMode ?? false),
  defaultDisplay: computed(() => props.defaultDisplay ?? "text"),
  update: (path, value) => setSheetValue(props.data, path, value),
  addRef: (id, ref) => emit("addRef", id, ref),
  addLink: (id, link) => emit("addLink", id, link),
  unlocked: reactive(new Set<string>()),
});
</script>

<template>
  <!-- `contain: paint` keeps Sheet CSS (even position: fixed) inside this box. -->
  <div
    class="sheet-root isolate space-y-4 [contain:paint]"
    :data-sheet="scopeId ?? undefined"
  >
    <SheetNodes :nodes="compiled.nodes" />
  </div>
</template>
