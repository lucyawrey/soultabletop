<script setup lang="ts">
import type { SheetScope } from "#shared/sheet/runtime";

// Makes `scope` the current item for paths inside (List items, Table rows).
const props = defineProps<{ scope: SheetScope }>();

provideSheetScope(computed(() => props.scope));
</script>

<template>
  <slot />
</template>
