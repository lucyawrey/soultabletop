<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

// <Sheet>: the root every sheet has.
const props = defineProps<{ node: ValidatedElement }>();
const compact = useSheetCompact();
</script>

<template>
  <div :class="[sheetClasses(props.node), compact ? 'space-y-2' : 'space-y-4']">
    <SheetNodes :nodes="node.children" />
  </div>
</template>
