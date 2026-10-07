<script setup lang="ts">
import { interpolateSheetText, sheetCondition } from "#shared/sheet/runtime";
import type { TextPart } from "#shared/sheet/parser";

// A roll entry's follow-up buttons (and Undo for a click that wrote). Labels
// and `show` are read live: from the entry's earlier rolls and the sheet as
// it is now, so "Reroll (2 left)" counts down and disappears at 0. A
// follow-up with a Set is left out for viewers who can't write. Used ones
// stay clickable, marked with a check and a dashed outline.
const props = defineProps<{ entry: SheetRollLogEntry }>();
const emit = defineEmits<{ followUp: [index: number, label: string]; undo: [] }>();

function writes(node: SheetRollLogEntry["followUps"][number]["node"]): boolean {
  return node.children.some((child) => child.type === "element" && (child.tag === "Set" || (child.tag === "FollowUp" && writes(child))));
}

const offered = computed(() => {
  const site = props.entry.site;
  const context = site.context();
  return props.entry.followUps.flatMap((followUp, index) => {
    const { root, scope, refs, formulas, shown } = context;
    if (!sheetCondition(followUp.node.attrs.show, root, scope, refs, formulas, followUp.params, shown).shown) return [];
    if (writes(followUp.node) && !site.canWrite()) return [];
    const label = interpolateSheetText(followUp.node.attrs.label as TextPart[], root, scope, refs, formulas, followUp.params, shown);
    return [{ index, label, used: props.entry.used.includes(index) }];
  });
});
</script>

<template>
  <div v-if="offered.length || (entry.undo && !entry.undone)" class="flex flex-wrap items-center gap-1">
    <button
      v-for="item in offered"
      :key="item.index"
      type="button"
      class="sheet-follow-up inline-flex items-center gap-1 rounded-full border border-primary bg-default px-2.5 py-0.5 text-xs font-bold text-primary hover:bg-primary hover:text-inverted"
      :class="item.used ? 'border-dashed' : ''"
      @click="emit('followUp', item.index, item.label)"
    >
      <UIcon v-if="item.used" name="i-lucide-check" class="size-3" />{{ item.label }}<span v-if="item.used" class="sr-only"> (used)</span>
    </button>
    <UButton
      v-if="entry.undo && !entry.undone"
      label="Undo"
      color="neutral"
      variant="outline"
      size="xs"
      class="ml-auto"
      @click="emit('undo')"
    />
  </div>
</template>
