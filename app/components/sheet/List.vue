<script setup lang="ts">
import { isBlankListItem, type SheetScope as SheetScopeValue } from "#shared/sheet/runtime";
import type { ValidatedElement } from "#shared/sheet/validate";

// <List>: its children once per item of the bound array, with add, remove,
// and reorder controls when editable, or once per entry of the bound struct
// (rows from the schema, so no controls).
const props = defineProps<{ node: ValidatedElement }>();

const { rows, resolve, context } = useSheet();
const attrText = useSheetAttrText();

const list = computed(() => resolve(props.node.binding!.path));
const scopes = computed(() => rows(props.node));
const label = computed(() => attrText(props.node.attrs.label));
const compact = useSheetCompact();
const layout = computed(() =>
  props.node.attrs.layout === "grid"
    ? [
        "grid grid-cols-1",
        compact.value ? "gap-2" : "gap-4",
        sheetGridCols[(props.node.attrs.cols as number | undefined) ?? 2],
      ]
    : compact.value
      ? "space-y-1"
      : "space-y-3",
);

const editing = useSheetListEditing(() => props.node, list);
const { unlock, remove, move } = editing;
const editable = computed(() => editing.editable.value && !props.node.entries);
const lockedEditable = computed(() => editing.lockedEditable.value && !props.node.entries);

// An item still blank when focus leaves it is dropped (see isBlankListItem).
const itemField = computed(() => {
  const field = props.node.binding?.field;
  return field?.type === "array" ? field.itemType : undefined;
});
function dropIfBlank(event: FocusEvent, index: number, scope: SheetScopeValue) {
  const item = event.currentTarget as HTMLElement;
  if (!editable.value || item.contains(event.relatedTarget as Node | null)) return;
  if (isBlankListItem(scope.value, itemField.value, context.schemas.value)) remove(index);
}
</script>

<template>
  <div :class="[sheetClasses(node), 'space-y-2']">
    <div
      v-if="label || lockedEditable"
      class="flex items-center gap-1 text-xs font-medium text-muted"
    >
      <span>{{ label }}</span>
      <SheetIconButton
        v-if="lockedEditable"
        icon="i-lucide-pencil"
        :label="`Edit ${label || 'list'}`"
        @click="unlock"
      />
    </div>
    <div v-if="scopes.length" :class="layout">
      <SheetScope
        v-for="(scope, index) in scopes"
        :key="index"
        :scope="scope"
        :repeat="scopes.length"
      >
        <div class="sheet-list-item flex gap-2" @focusout="dropIfBlank($event, index, scope)">
          <div class="min-w-0 flex-1" :class="compact ? 'space-y-2' : 'space-y-3'">
            <SheetNodes :nodes="node.children" />
          </div>
          <div v-if="editable" class="flex shrink-0 flex-col gap-1">
            <SheetIconButton
              icon="i-lucide-arrow-up"
              label="Move up"
              :disabled="index === 0"
              @click="move(index, -1)"
            />
            <SheetIconButton
              icon="i-lucide-arrow-down"
              label="Move down"
              :disabled="index === scopes.length - 1"
              @click="move(index, 1)"
            />
            <SheetIconButton
              icon="i-lucide-trash"
              color="error"
              label="Remove"
              @click="remove(index)"
            />
          </div>
        </div>
      </SheetScope>
    </div>
    <p v-else-if="!editable" class="text-sm text-dimmed">None</p>
    <SheetListAdd
      v-if="editable"
      :node="node"
      :label="attrText(node.attrs.addLabel) || 'Add'"
      :list="list"
    />
  </div>
</template>
