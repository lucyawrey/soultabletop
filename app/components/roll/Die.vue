<script setup lang="ts">
// One die of a roll: a simple outline per die size, the face on top. Critical
// faces are filled, fumbles dashed in the error color, dropped dice muted and
// struck through. The outlines were drawn for this component (an exception
// to "agents don't make art" the user approved); team art can replace them
// here. See .claude/mockups/dice-rolls/spec.md.
const props = defineProps<{
  sides: number;
  face: number;
  kept: boolean;
  mark?: "crit" | "fumble";
  // Width and height in px.
  size?: number;
}>();

// Outlines in a 100×100 box, each filling about the same area. Sizes without
// their own shape use the circle.
const shapes: Record<number, string> = {
  4: "50,5 96,88 4,88",
  8: "50,2 98,50 50,98 2,50",
  10: "50,1 99,38 50,99 1,38",
  12: "50,1 99,36 81,97 19,97 1,36",
  20: "50,2 94,26 94,74 50,98 6,74 6,26",
};
const points = computed(() => shapes[props.sides === 100 ? 10 : props.sides]);
const size = computed(() => props.size ?? 30);
// The face's nudge inside shapes whose middle isn't the box's.
const nudge: Record<number, string> = { 4: "translateY(20%)", 10: "translateY(-10%)", 12: "translateY(8%)" };
const label = computed(
  () =>
    `d${props.sides}: ${props.face}${props.kept ? "" : ", dropped"}${props.mark === "crit" ? ", critical" : props.mark === "fumble" ? ", fumble" : ""}`,
);
const state = computed(() => (!props.kept ? "dropped" : (props.mark ?? "plain")));
</script>

<template>
  <span
    class="roll-die relative inline-grid shrink-0 place-items-center font-extrabold tabular-nums"
    :class="{
      'roll-die-crit': state === 'crit',
      'roll-die-fumble': state === 'fumble',
      'roll-die-dropped': state === 'dropped',
    }"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size * (face >= 10 ? 0.31 : 0.36)}px` }"
    role="img"
    :aria-label="label"
    :title="label"
  >
    <svg viewBox="0 0 100 100" aria-hidden="true" class="absolute inset-0 size-full overflow-visible">
      <rect v-if="sides === 6" x="9" y="9" width="82" height="82" />
      <polygon v-else-if="points" :points="points" />
      <circle v-else cx="50" cy="50" r="44" />
    </svg>
    <b class="relative leading-none" :style="{ transform: nudge[sides === 100 ? 10 : sides] }">{{ face }}</b>
  </span>
</template>

<style scoped>
.roll-die svg * {
  fill: var(--ui-bg);
  stroke: var(--ui-primary);
  stroke-width: 2px;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.roll-die b { color: var(--ui-text-highlighted); }
.roll-die-crit svg * { fill: var(--ui-primary); }
.roll-die-crit b { color: var(--ui-text-inverted); }
/* A fumble: dashed in the error color (not color alone) over a faint tint. */
.roll-die-fumble svg * {
  fill: color-mix(in srgb, var(--ui-error) 8%, var(--ui-bg));
  stroke: var(--ui-error);
  stroke-dasharray: 5 3;
}
.roll-die-fumble b { color: var(--ui-error); }
.roll-die-dropped svg * { fill: var(--ui-bg-elevated); stroke: var(--ui-border-accented); }
.roll-die-dropped b {
  color: var(--ui-text-muted);
  text-decoration: line-through;
  text-decoration-thickness: 2px;
}
</style>
