<script setup lang="ts">
// A roll in the toast (the Dice card look, frozen in
// .claude/mockups/dice-rolls/): a header band with the action and the roll,
// the dice tumbling in with the total right after them, the expression as
// rolled, and the follow-ups.
// `from`: the entry whose follow-up made this one.
const props = defineProps<{ entry: SheetRollLogEntry; from?: SheetRollLogEntry }>();
const emit = defineEmits<{ followUp: [index: number, label: string]; undo: [] }>();
const time = computed(() => props.entry.when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
// The total appears once the dice land. A new roll in the same toast (the
// next roll, or a follow-up) replaces the entry without remounting the card,
// so the timer starts again and the content below is keyed by the entry,
// which makes the dice tumble again.
const landed = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => props.entry.id,
  () => {
    landed.value = false;
    clearTimeout(timer);
    timer = setTimeout(() => (landed.value = true), 750);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div :key="entry.id" class="roll-card w-full text-sm">
    <div class="flex items-baseline gap-1.5 border-b border-default bg-elevated py-2 pr-11 pl-3">
      <span class="font-bold text-highlighted">{{ entry.title }}</span>
      <span class="text-muted">{{ entry.label }}</span>
      <span v-if="entry.undone" class="text-xs text-muted">(undone)</span>
      <time class="ml-auto text-xs whitespace-nowrap text-muted">{{ time }}</time>
    </div>
    <div v-if="from" class="px-3 pt-1.5 text-xs text-muted">
      ↳ from <b class="font-semibold text-default">{{ from.title }} · {{ from.label }}</b> {{ from.total
      }}<template v-if="from.natural !== null"> (natural {{ from.natural }})</template>
    </div>
    <div class="px-3 pt-2.5 pb-2">
      <RollDice :term="entry.term" :size="40" animate>
        <span class="inline-flex items-center gap-2">
          <span class="text-xl text-muted">=</span>
          <b
            class="roll-total font-display text-[44px] leading-[0.9] font-bold text-highlighted tabular-nums"
            :class="landed ? 'roll-settle' : 'invisible'"
          >{{ entry.total }}</b>
        </span>
      </RollDice>
    </div>
    <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 pb-2">
      <span class="text-muted">{{ entry.expression }}</span>
      <RollNaturalBadge :entry="entry" />
    </div>
    <div v-if="entry.followUps.length || entry.undo" class="border-t border-default px-3 pt-2 pb-2.5">
      <RollFollowUps :entry="entry" @follow-up="(index, label) => emit('followUp', index, label)" @undo="emit('undo')" />
    </div>
  </div>
</template>

<style scoped>
.roll-total { font-variant-numeric: lining-nums tabular-nums; }
@media (prefers-reduced-motion: no-preference) {
  .roll-settle { animation: roll-settle 0.35s ease-out both; }
  @keyframes roll-settle {
    0% { transform: scale(0.6); opacity: 0; }
    70% { transform: scale(1.12); }
    100% { transform: none; opacity: 1; }
  }
}
</style>
