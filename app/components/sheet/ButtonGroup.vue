<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

// Adjacent Buttons with `amount` (grouped by SheetNodes): one number box
// before them, whose value their Set formulas read as `amount`. Clicking one
// clears it. Only viewers who can edit see it.
const props = defineProps<{ nodes: ValidatedElement[] }>();

const { context, condition } = useSheet();
const flags = useSheetFlags();
const attrText = useSheetAttrText();
const compact = useSheetCompact();
const amount = provideSheetButtonAmount();

const shown = computed(
  () => context.canEdit.value && props.nodes.some((node) => condition(node.attrs.show).shown),
);
const usable = computed(() =>
  props.nodes.some((node) => sheetButtonUsable(context, flags.value, node)),
);
// Names the box for screen readers: "Amount for Damage or Heal".
const boxLabel = computed(
  () => `Amount for ${props.nodes.map((node) => attrText(node.attrs.label)).join(" or ")}`,
);
</script>

<template>
  <div v-if="shown" class="sheet-button-group flex flex-wrap items-center gap-1">
    <UInputNumber
      v-model="amount"
      :min="0"
      placeholder="0"
      :size="compact ? 'xs' : 'sm'"
      :disabled="!usable"
      :aria-label="boxLabel"
      :increment="false"
      :decrement="false"
      class="w-16"
    />
    <SheetNode v-for="(node, index) in nodes" :key="`${node.loc.start.offset}-${index}`" :node="node" />
  </div>
</template>
