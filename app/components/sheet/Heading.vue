<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

const props = defineProps<{ node: ValidatedElement }>();

const segments = useSheetChildSegments(() => props.node);
const level = computed(() => (props.node.attrs.level as number | undefined) ?? 1);
const sizes: Record<number, string> = {
  1: "text-2xl",
  2: "text-xl",
  3: "text-lg",
  4: "text-base",
};
</script>

<template>
  <component
    :is="`h${level + 1}`"
    :class="[sheetClasses(node), sizes[level], 'font-bold text-highlighted']"
  >
    <SheetInlineText :segments="segments" />
  </component>
</template>
