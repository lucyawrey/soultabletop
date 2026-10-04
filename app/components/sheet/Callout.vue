<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

type Color = "primary" | "secondary" | "success" | "info" | "warning" | "error" | "neutral";

const props = defineProps<{ node: ValidatedElement }>();

const attrText = useSheetAttrText();
const segments = useSheetChildSegments(() => props.node);
const title = computed(() => attrText(props.node.attrs.title) || undefined);
const color = computed(() => (props.node.attrs.color as Color | undefined) ?? "info");
const icon = computed(() => props.node.attrs.icon as string | undefined);
</script>

<template>
  <UAlert
    :class="sheetClasses(node)"
    :color="color"
    variant="subtle"
    :icon="icon"
    :title="title"
  >
    <template v-if="segments.length" #description>
      <SheetInlineText :segments="segments" />
    </template>
  </UAlert>
</template>
