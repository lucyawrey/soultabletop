<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

const props = defineProps<{ node: ValidatedElement }>();

const cols = computed(
  () => sheetGridCols[(props.node.attrs.cols as number | undefined) ?? 2],
);
const compact = useSheetCompact();
const gap = computed(
  () => (compact.value ? sheetGapCompact : sheetGap)[(props.node.attrs.gap as string | undefined) ?? "md"],
);
</script>

<template>
  <div :class="[sheetClasses(node), 'grid grid-cols-1', cols, gap]">
    <SheetNodes :nodes="node.children" />
  </div>
</template>
