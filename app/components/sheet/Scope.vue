<script setup lang="ts">
import type { SheetScope } from "#shared/sheet/runtime";

// Makes `scope` the current item for paths inside (List items, Table rows).
// `repeat` is how many items there are, which formulas inside share their
// step budget with.
const props = defineProps<{ scope: SheetScope; repeat?: number }>();

provideSheetScope(computed(() => props.scope), () => props.repeat ?? 1);
</script>

<template>
  <slot />
</template>
