<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

type Color = "primary" | "secondary" | "success" | "info" | "warning" | "error" | "neutral";

const props = defineProps<{ node: ValidatedElement }>();

const text = useSheetChildText(() => props.node);
const color = computed(() => (props.node.attrs.color as Color | undefined) ?? "primary");
</script>

<template>
  <div>
    <UBadge
      :class="sheetClasses(node)"
      :color="color"
      variant="subtle"
      :label="text"
    />
  </div>
</template>
