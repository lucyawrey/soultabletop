<script setup lang="ts">
// One roll in Recent rolls: compact (total, expression, dice, follow-ups),
// with Details expanding the rest in place.
const props = defineProps<{ entry: SheetRollLogEntry }>();

const rolls = useSheetRolls();
const open = ref(false);
const detailsId = useId();
const from = computed(() =>
  props.entry.from ? rolls.entries.value.find((item) => item.id === props.entry.from) : undefined,
);
const time = computed(() => props.entry.when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
// Named rolls before this one (what its follow-ups read).
const earlier = computed(() =>
  Object.entries(props.entry.records).filter(([name]) => name !== props.entry.name),
);
</script>

<template>
  <article class="grid gap-1 px-3 py-2 text-sm" :class="entry.from ? 'border-l-3 border-accented' : ''">
    <div class="flex items-baseline gap-1.5">
      <span class="font-bold text-highlighted">{{ entry.title }}</span>
      <span class="text-muted">{{ entry.label }}</span>
      <span v-if="entry.undone" class="text-xs text-muted">(undone)</span>
      <time class="ml-auto text-xs whitespace-nowrap text-muted">{{ time }}</time>
    </div>
    <div v-if="from" class="text-xs text-muted">
      ↳ from <b class="font-semibold text-default">{{ from.title }} · {{ from.label }}</b> {{ from.total
      }}<template v-if="from.natural !== null"> (natural {{ from.natural }})</template>
    </div>
    <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span class="roll-total min-w-[1.4em] font-display text-[26px] leading-none font-bold text-highlighted">{{ entry.total }}</span>
      <span>{{ entry.expression }}</span>
      <RollNaturalBadge :entry="entry" />
    </div>
    <RollDice :term="entry.term" :size="24" />
    <div v-if="open" :id="detailsId" class="grid grid-cols-[max-content_1fr] gap-x-2.5 gap-y-px text-xs text-muted">
      <template v-if="entry.natural !== null">
        <span>Natural</span><b class="font-semibold text-default">{{ entry.natural }}</b>
      </template>
      <template v-if="earlier.length">
        <span>Earlier</span>
        <span>
          <template v-for="([name, record], index) in earlier" :key="name">
            <template v-if="index"> · </template>{{ name }} <b class="font-semibold text-default">{{ record.total }}</b><template v-if="record.natural !== null"> (natural {{ record.natural }})</template>
          </template>
        </span>
      </template>
      <span>Source</span><span>{{ entry.title }}</span>
      <span>Rolled</span><span>by you · {{ time }}</span>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <RollFollowUps
        :entry="entry"
        class="flex-1"
        @follow-up="(index, label) => rolls.followUp(entry, index, label)"
        @undo="rolls.undo(entry)"
      />
      <button
        type="button"
        class="ml-auto inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs font-semibold text-muted hover:text-default hover:underline"
        :aria-expanded="open"
        :aria-controls="detailsId"
        @click="open = !open"
      >
        <UIcon name="i-lucide-chevron-right" class="size-3.5 transition-transform" :class="open ? 'rotate-90' : ''" />Details
      </button>
    </div>
  </article>
</template>

<style scoped>
.roll-total { font-variant-numeric: lining-nums tabular-nums; }
</style>
