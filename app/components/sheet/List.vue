<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

// <List>: its children once per item of the bound array, with add, remove,
// and reorder controls when editable.
const props = defineProps<{ node: ValidatedElement }>();

const { items, resolve } = useSheet();
const attrText = useSheetAttrText();

const list = computed(() => resolve(props.node.binding!.path));
const scopes = computed(() => items(props.node.binding!.path));
const label = computed(() => attrText(props.node.attrs.label));
const layout = computed(() =>
  props.node.attrs.layout === "grid"
    ? [
        "grid grid-cols-1 gap-4",
        sheetGridCols[(props.node.attrs.cols as number | undefined) ?? 2],
      ]
    : "space-y-3",
);

const { editable, lockedEditable, unlock, remove, move } = useSheetListEditing(
  () => props.node,
  list,
);
</script>

<template>
  <div :class="[sheetClasses(node), 'space-y-2']">
    <div
      v-if="label || lockedEditable"
      class="flex items-center gap-1 text-xs font-medium text-muted"
    >
      <span>{{ label }}</span>
      <UButton
        v-if="lockedEditable"
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Edit ${label || 'list'}`"
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
        <div class="sheet-list-item flex gap-2">
          <div class="min-w-0 flex-1 space-y-3">
            <SheetNodes :nodes="node.children" />
          </div>
          <div v-if="editable" class="flex shrink-0 flex-col gap-1">
            <UButton
              icon="i-lucide-arrow-up"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Move up"
              :disabled="index === 0"
              @click="move(index, -1)"
            />
            <UButton
              icon="i-lucide-arrow-down"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Move down"
              :disabled="index === scopes.length - 1"
              @click="move(index, 1)"
            />
            <UButton
              icon="i-lucide-trash"
              color="error"
              variant="ghost"
              size="xs"
              aria-label="Remove"
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
