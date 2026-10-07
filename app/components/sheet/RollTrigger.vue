<script setup lang="ts">
import { toFormulaValue } from "#shared/sheet/formula";
import { sheetActionSteps, sheetActionWrites, sheetValueAt } from "#shared/sheet/runtime";
import type { ValidatedElement } from "#shared/sheet/validate";

// A value with steps (<Roll>, <Set>, <FollowUp>): clicking runs them. As a
// die button beside the value (`button`: the value also opens a breakdown or
// preview, or <Sheet rolls="button">) or as the value itself. An action with
// only Rolls works for every viewer; one that writes needs what a Button
// needs (edit rights, and Edit on or live). Otherwise just the value shows.
const props = defineProps<{
  node: ValidatedElement;
  // The value shown, for value().
  shown: unknown;
  // The action's name in its entries.
  title: string;
  button?: boolean;
}>();

const { context, scope } = useSheet();
const flags = useSheetFlags();
const rolls = injectSheetRolls();

const canWrite = () => sheetButtonUsable(context, flags.value, props.node);
const enabled = computed(
  () => !!rolls && sheetActionSteps(props.node) && (!sheetActionWrites(props.node) || canWrite()),
);

function roll() {
  rolls?.run(props.node.children, {
    context: () => ({
      root: context.root.value,
      scope: scope.value,
      refs: context.refs.value,
      formulas: context.formulas.value,
      shown: toFormulaValue(props.shown),
    }),
    title: () => props.title,
    canWrite,
    update: context.update,
    read: (path) => sheetValueAt(context.root.value.value, path),
  });
}
</script>

<template>
  <slot v-if="!enabled" />
  <span v-else-if="button" class="inline-flex items-center gap-1">
    <slot />
    <button
      type="button"
      class="sheet-roll-trigger inline-grid size-[22px] shrink-0 place-items-center rounded-[5px] border border-accented bg-default text-primary hover:border-primary hover:bg-primary hover:text-inverted"
      :aria-label="`Roll ${title}`"
      :title="`Roll ${title}`"
      @click="roll"
    >
      <UIcon name="i-game-icons-rolling-dices" class="size-[17px]" />
    </button>
  </span>
  <button
    v-else
    type="button"
    class="sheet-roll-trigger cursor-pointer border-b-2 border-primary px-0.5 font-bold text-primary tabular-nums hover:bg-primary/10"
    :aria-label="`Roll ${title}`"
    :title="`Roll ${title}`"
    @click="roll"
  >
    <slot />
  </button>
</template>
