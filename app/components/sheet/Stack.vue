<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

const props = defineProps<{ node: ValidatedElement }>();

const compact = useSheetCompact();
const classes = computed(() => [
  props.node.attrs.direction === "row" ? "flex-row" : "flex-col",
  (compact.value ? sheetGapCompact : sheetGap)[(props.node.attrs.gap as string | undefined) ?? "md"],
  sheetAlign[props.node.attrs.align as string],
  props.node.attrs.wrap === true ? "flex-wrap" : undefined,
]);
</script>

<template>
  <div :class="[sheetClasses(node), 'flex', classes]">
    <SheetNodes :nodes="node.children" />
  </div>
</template>
