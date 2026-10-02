<script setup lang="ts">
// A small pill, the mockup's badge: bold 12px on a rounded fill. Pills in the
// app use this rather than `UBadge`, whose tints don't match the theme's soft
// fills; Sheet badges keep `UBadge`. Tones:
// - `primary`: solid plum (Official)
// - `primarySoft`: plum on its soft fill (Default, Admin)
// - `accent`: gilt on its soft fill (Public)
// - `neutral`: muted text on the shaded surface (Community, categories)
// - `outline`: a dashed outline (Limited), so state isn't color alone
// - `error`: red on a light tint (Expired)
const props = withDefaults(
  defineProps<{
    tone?: "primary" | "primarySoft" | "accent" | "neutral" | "outline" | "error";
  }>(),
  { tone: "neutral" },
);

// The outline's 1px border comes out of its padding, so every tone is the
// same size.
const FILLED = "px-2 py-[3px]";
const TONES = {
  primary: `${FILLED} bg-primary text-inverted`,
  primarySoft: `${FILLED} bg-(--ui-primary-soft) text-primary`,
  accent: `${FILLED} bg-(--ui-secondary-soft) text-secondary`,
  neutral: `${FILLED} bg-elevated text-muted`,
  outline: "border border-dashed border-default px-[7px] py-[2px] text-muted",
  error: `${FILLED} bg-error/10 text-error`,
};
const toneClass = computed(() => TONES[props.tone]);
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full text-xs/[1.2] font-bold whitespace-nowrap"
    :class="toneClass"
  >
    <slot />
  </span>
</template>
