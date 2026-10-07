<script setup lang="ts">
import { hasSheetParts } from "#shared/sheet/runtime";
import type { ValidatedElement } from "#shared/sheet/validate";
import SheetField from "./Field.vue";

// A Table <Column> with Buttons: one set per row, after the column's value
// when it also has a field, formula, or parts.
const props = defineProps<{ node: ValidatedElement; compact?: boolean }>();

const hasValue = computed(
  () => !!props.node.binding || !!props.node.formula || hasSheetParts(props.node),
);
const buttons = computed(() =>
  props.node.children.filter((child) => child.type === "element" && child.tag === "Button"),
);
</script>

<template>
  <!-- With a value, its Field carries the Column's classes. -->
  <div :class="[hasValue ? [] : sheetClasses(node), 'flex flex-wrap items-center gap-1']">
    <SheetField v-if="hasValue" :node="node" compact />
    <SheetNodes :nodes="buttons" />
  </div>
</template>
