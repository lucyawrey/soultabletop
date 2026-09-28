<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

const props = defineProps<{ node: ValidatedElement }>();

const text = useSheetChildText(() => props.node);
</script>

<template>
  <p :class="[sheetClasses(node), 'text-sm text-muted']">{{ text }}</p>
</template>
