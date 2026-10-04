<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

const props = defineProps<{ node: ValidatedElement }>();

const segments = useSheetChildSegments(() => props.node);
</script>

<template>
  <p :class="[sheetClasses(node), 'text-sm text-muted']">
    <SheetInlineText :segments="segments" />
  </p>
</template>
