<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

// <Sheet>: the optional root.
const props = defineProps<{ node: ValidatedElement }>();
</script>

<template>
  <div :class="[sheetClasses(props.node), 'space-y-4']">
    <SheetNodes :nodes="node.children" />
  </div>
</template>
