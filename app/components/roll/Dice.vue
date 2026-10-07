<script setup lang="ts">
import { rollTermDice, type RollTerm } from "#shared/sheet/roll";

// A roll's expression as rolled, laid out: each term's dice together (kept
// first, dropped last), captioned in words when the roll has more than one
// die ("2d6", "4d6 · keep highest 3"), with the numbers and operators between
// them. The default slot (the total) follows the last item, so the sum reads
// left to right. `animate` tumbles the dice in.
const props = defineProps<{ term: RollTerm; size?: number; animate?: boolean }>();

type Item =
  | { kind: "dice"; term: Extract<RollTerm, { kind: "dice" }> }
  | { kind: "text"; text: string; strong?: boolean };

const symbols = { "+": "+", "-": "−", "*": "×", "/": "÷" } as const;
const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 } as const;

function flatten(term: RollTerm, parent: number, right: boolean): Item[] {
  switch (term.kind) {
    case "dice":
      return [{ kind: "dice", term }];
    case "number":
      return [{ kind: "text", text: term.value < 0 ? `−${-term.value}` : String(term.value), strong: true }];
    case "neg":
      return [{ kind: "text", text: "−" }, ...flatten(term.operand, 3, false)];
    case "op": {
      const own = precedence[term.op];
      const inner = [...flatten(term.left, own, false), { kind: "text" as const, text: symbols[term.op] }, ...flatten(term.right, own, true)];
      return own < parent || (right && own === parent && parent > 0)
        ? [{ kind: "text", text: "(" }, ...inner, { kind: "text", text: ")" }]
        : inner;
    }
  }
}

const items = computed(() => flatten(props.term, 0, false));
const count = computed(() => rollTermDice(props.term).length);
// Dice shrink a little when a roll has more than six.
const dieSize = computed(() => (count.value > 6 ? Math.round((props.size ?? 40) * 0.75) : (props.size ?? 40)));

function caption(term: Extract<RollTerm, { kind: "dice" }>) {
  const keep = term.keep
    ? term.count === 2 && term.keep.count === 1
      ? ` · keep ${term.keep.mode === "h" ? "higher" : "lower"}`
      : ` · keep ${term.keep.mode === "h" ? "highest" : "lowest"} ${term.keep.count}`
    : "";
  return `${term.count > 1 ? term.count : ""}d${term.sides}${keep}`;
}

function ordered(term: Extract<RollTerm, { kind: "dice" }>) {
  return [...term.dice.filter((die) => die.kept), ...term.dice.filter((die) => !die.kept)];
}

// Each die's place among all the roll's dice, for staggered tumbling.
const order = computed(() => {
  const map = new Map<object, number>();
  rollTermDice(props.term).forEach((die, index) => map.set(die, index));
  return map;
});
</script>

<template>
  <div class="roll-dice flex flex-wrap items-end gap-x-2 gap-y-1.5">
    <template v-for="(item, index) in items" :key="index">
      <span v-if="item.kind === 'dice'" class="inline-grid justify-items-center gap-0.5">
        <span class="inline-flex flex-wrap items-end gap-[3px]">
          <span
            v-for="(die, dieIndex) in ordered(item.term)"
            :key="dieIndex"
            class="inline-grid"
            :class="animate ? 'roll-tumble' : ''"
            :style="animate ? { animationDelay: `${(order.get(die) ?? 0) * 60}ms` } : undefined"
          >
            <RollDie :sides="die.sides" :face="die.face" :kept="die.kept" :mark="die.mark" :size="dieSize" />
          </span>
        </span>
        <small v-if="count > 1" class="text-[10.5px] font-bold text-muted">{{ caption(item.term) }}</small>
      </span>
      <span
        v-else
        class="self-center"
        :class="item.strong ? 'font-extrabold tabular-nums text-highlighted' : 'font-bold text-muted'"
        :style="count > 1 ? { marginBottom: '16px' } : undefined"
      >{{ item.text }}</span>
    </template>
    <span class="self-center" :style="count > 1 ? { marginBottom: '16px' } : undefined"><slot /></span>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .roll-tumble { animation: roll-tumble 0.85s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
  @keyframes roll-tumble {
    0% { transform: translate(-36px, -18px) rotate(-280deg) scale(0.6); opacity: 0.2; }
    55% { transform: translate(4px, 2px) rotate(24deg) scale(1.05); opacity: 1; }
    78% { transform: rotate(-8deg); }
    100% { transform: none; }
  }
}
</style>
