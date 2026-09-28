<script setup lang="ts">
import type { SheetRefs } from "#shared/sheet/runtime";
import { compileSheet, type SheetSchemas } from "#shared/sheet/validate";

// Renders Content with Sheet markup. See docs/sheet-system.md, section 5.
const props = defineProps<{
  markup: string;
  schemas: SheetSchemas;
  // Content data including the built-in `name`.
  data: Record<string, unknown>;
  refs: SheetRefs;
  // Show placeholders for broken tags (users who can edit the Sheet).
  canEditSheet?: boolean;
}>();

const compiled = computed(() => compileSheet(props.markup, props.schemas));

provideSheetContext({
  root: computed(() => ({ value: props.data, path: [] })),
  refs: computed(() => props.refs),
  showInvalid: computed(() => props.canEditSheet ?? false),
});
</script>

<template>
  <div class="sheet-root space-y-4">
    <SheetNodes :nodes="compiled.nodes" />
  </div>
</template>
