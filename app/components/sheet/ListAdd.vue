<script setup lang="ts">
import { defaultSheetValue, filterDataKeys, type SheetRef, type SheetScope } from "#shared/sheet/runtime";
import {
  isCompiledFormula,
  type CompiledFormula,
  type ValidatedElement,
  type ValidatedNode,
} from "#shared/sheet/validate";

// "Add" controls under an editable List or Table. Lists of Content get a
// picker for existing Content, led by a "Custom …" option if allowed; so do
// Lists whose `addPick` names a content field of each item, adding a row with
// that field set.
const props = defineProps<{
  node: ValidatedElement;
  label: string;
  list: SheetScope;
}>();

const { context, condition } = useSheet();
const attrText = useSheetAttrText();

const itemField = computed(() => {
  const field = props.node.binding?.field;
  return field?.type === "array" ? field.itemType : undefined;
});
const pickKey = computed(() => attrText(props.node.attrs.addPick) || undefined);
const contentField = computed(() => {
  const item = itemField.value;
  if (pickKey.value && item?.type === "struct") {
    const entry = Object.hasOwn(item.entries, pickKey.value) ? item.entries[pickKey.value] : undefined;
    return entry?.type === "content" ? entry : undefined;
  }
  return item?.type === "content" ? item : undefined;
});
// With `addPick`, the picker offers what the row's own picker for that field
// does: the `filter` of the first tag in the template bound to it.
function findFilter(nodes: ValidatedNode[]): CompiledFormula | undefined {
  for (const child of nodes) {
    if (child.type !== "element") continue;
    const path = child.binding?.path;
    const filter = child.attrs.filter;
    if (path && !path.absolute && path.segments.join(".") === pickKey.value && isCompiledFormula(filter))
      return filter;
    const nested = findFilter(child.children);
    if (nested) return nested;
  }
  return undefined;
}
const filter = computed(() => (pickKey.value ? findFilter(props.node.children) : undefined));
const filterKeys = computed(() => (filter.value ? filterDataKeys(filter.value.ast) : undefined));
function accepts(data: Record<string, unknown>) {
  return condition(filter.value, { value: data, path: null }).shown;
}
// The row to add for a picked or custom value.
function row(value: unknown) {
  if (!pickKey.value) return value;
  const base = defaultSheetValue(itemField.value, context.schemas.value);
  return { ...(base && typeof base === "object" ? base : {}), [pickKey.value]: value };
}

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
  append(row(id));
  picks.value += 1;
}
function addCustom() {
  append(
    pickKey.value
      ? row(defaultSheetValue(contentField.value, context.schemas.value))
      : defaultSheetValue(itemField.value, context.schemas.value),
  );
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
        :data-keys="filterKeys"
        :accepts="filter ? accepts : undefined"
        :custom-label="contentField.allow === 'both' ? `Custom ${contentField.label ?? label}` : undefined"
        @pick="pick"
        @custom="addCustom"
      />
    </div>
    <UButton
      v-if="!contentField || contentField.allow === 'local'"
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      size="sm"
      :label="label"
      @click="addCustom"
    />
  </div>
</template>
