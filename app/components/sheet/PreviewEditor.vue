<script setup lang="ts">
import type { SheetPreviewTarget } from "#shared/sheet/card";
import { generateSheetMarkup } from "#shared/sheet/generate";

// A custom entry's card while it's being edited: its content type's fields as
// inputs (a generated sheet), writing straight into the entry. Its name isn't
// repeated: it's typed where the picked name would be.
const props = defineProps<{ target: SheetPreviewTarget }>();

const { context } = useSheet();
const schemas = computed(() => {
  const rules = context.schemas.value.types[props.target.contentTypeId];
  return rules ? { ...context.schemas.value, root: rules } : undefined;
});
const markup = computed(() =>
  schemas.value ? generateSheetMarkup(schemas.value, { name: false }) : "",
);
</script>

<template>
  <SheetRenderer
    v-if="schemas"
    class="sheet-preview-editor"
    :markup="markup"
    :schemas="schemas"
    :data="target.record"
    :refs="context.refs.value"
    :links="context.links.value"
    can-edit
    edit-mode
    @add-ref="context.addRef"
    @add-link="context.addLink"
  />
  <p v-else class="text-sm text-dimmed">Loading…</p>
</template>
