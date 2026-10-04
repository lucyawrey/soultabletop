<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

type Color = "primary" | "secondary" | "success" | "info" | "warning" | "error" | "neutral";

const props = defineProps<{ node: ValidatedElement }>();

const segments = useSheetChildSegments(() => props.node);
const color = computed(() => (props.node.attrs.color as Color | undefined) ?? "primary");
</script>

<template>
  <div>
    <UBadge
      :class="sheetClasses(node)"
      :color="color"
      variant="subtle"
    >
      <SheetInlineText :segments="segments" />
    </UBadge>
  </div>
</template>
