<script setup lang="ts">
import type { ValidatedElement, ValidatedNode } from "#shared/sheet/validate";

const props = defineProps<{ nodes: ValidatedNode[] }>();

const isAmountButton = (node: ValidatedNode): node is ValidatedElement =>
  node.type === "element" && node.tag === "Button" && node.attrs.amount === true;

// Adjacent Buttons with `amount` share one number box (SheetButtonGroup).
const items = computed(() => {
  const result: ({ node: ValidatedNode; group?: never } | { group: ValidatedElement[]; node?: never })[] = [];
  for (const node of props.nodes) {
    const last = result.at(-1);
    if (!isAmountButton(node)) result.push({ node });
    else if (last?.group) last.group.push(node);
    else result.push({ group: [node] });
  }
  return result;
});
</script>

<template>
  <template v-for="(item, index) in items">
    <SheetButtonGroup
      v-if="item.group"
      :key="`${item.group[0]!.loc.start.offset}-group`"
      :nodes="item.group"
    />
    <SheetNode
      v-else
      :key="`${item.node.loc.start.offset}-${index}`"
      :node="item.node"
    />
  </template>
</template>
