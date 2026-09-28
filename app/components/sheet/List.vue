<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

// <List>: its children once per item of the bound array.
const props = defineProps<{ node: ValidatedElement }>();

const { items } = useSheet();
const attrText = useSheetAttrText();

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
</script>

<template>
  <div :class="[sheetClasses(node), 'space-y-2']">
    <div v-if="label" class="text-xs font-medium text-muted">{{ label }}</div>
    <div v-if="scopes.length" :class="layout">
      <SheetScope v-for="(scope, index) in scopes" :key="index" :scope="scope">
        <div class="sheet-list-item space-y-3">
          <SheetNodes :nodes="node.children" />
        </div>
      </SheetScope>
    </div>
    <p v-else class="text-sm text-dimmed">None</p>
  </div>
</template>
