<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

const props = defineProps<{ node: ValidatedElement }>();

const attrText = useSheetAttrText();
const label = computed(() => attrText(props.node.attrs.label) || undefined);
</script>

<template>
  <USeparator :label="label" :class="sheetClasses(node)" />
</template>
