<script setup lang="ts">
import { defaultSheetValue, type SheetRef, type SheetScope } from "#shared/sheet/runtime";
import type { ValidatedElement } from "#shared/sheet/validate";

// "Add" controls under an editable List or Table. Lists of Content get a
// picker for existing Content and, if allowed, a button for custom items.
const props = defineProps<{
  node: ValidatedElement;
  label: string;
  list: SheetScope;
}>();

const { context } = useSheet();

const itemField = computed(() => {
  const field = props.node.binding?.field;
  return field?.type === "array" ? field.itemType : undefined;
});
const contentField = computed(() =>
  itemField.value?.type === "content" ? itemField.value : undefined,
);

function append(value: unknown) {
  if (!props.list.path) return;
  const current = Array.isArray(props.list.value) ? props.list.value : [];
  context.update(props.list.path, [...current, value]);
}

// The picker is remade after each pick, so it starts empty again and the
// same content can be added twice.
const picks = ref(0);
function pick(id: string, ref: SheetRef) {
  context.addRef(id, ref);
  append(id);
  picks.value += 1;
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div v-if="contentField && contentField.allow !== 'local'" class="w-56">
      <SheetContentPicker
        :key="picks"
        :content-type-id="contentField.contentTypeId"
        :placeholder="`${label}…`"
        @pick="pick"
      />
    </div>
    <UButton
      v-if="!contentField || contentField.allow !== 'reference'"
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      size="sm"
      :label="contentField ? `${label} custom` : label"
      @click="append(defaultSheetValue(itemField, context.schemas.value))"
    />
  </div>
</template>
