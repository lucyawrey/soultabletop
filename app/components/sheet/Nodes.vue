<script setup lang="ts">
import type { ValidatedNode } from "#shared/sheet/validate";

defineProps<{ nodes: ValidatedNode[] }>();
</script>

<template>
  <SheetNode
    v-for="(node, index) in nodes"
    :key="`${node.loc.start.offset}-${index}`"
    :node="node"
  />
</template>
