<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

// A Table <Column> of Buttons instead of a field: one set per row.
defineProps<{ node: ValidatedElement; compact?: boolean }>();
</script>

<template>
  <div :class="[sheetClasses(node), 'flex flex-wrap items-center gap-1']">
    <SheetNodes :nodes="node.children" />
  </div>
</template>
