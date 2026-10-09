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
    // `sm`: bold 10px, for tight places like dropdown options.
    size?: "md" | "sm";
  }>(),
  { tone: "neutral", size: "md" },
);

const TONES = {
  primary: "bg-primary text-inverted",
  primarySoft: "bg-(--ui-primary-soft) text-primary",
  accent: "bg-(--ui-secondary-soft) text-secondary",
  neutral: "bg-elevated text-muted",
  outline: "border border-dashed border-default text-muted",
  error: "bg-error/10 text-error",
};
// The outline's 1px border comes out of its padding, so every tone is the
// same size.
const SIZES = {
  md: { filled: "px-2 py-[3px] text-xs/[1.2]", outline: "px-[7px] py-[2px] text-xs/[1.2]" },
  sm: { filled: "px-1.5 py-px text-[10px]/[1.2]", outline: "px-[5px] py-0 text-[10px]/[1.2]" },
};
const toneClass = computed(() => [
  TONES[props.tone],
  SIZES[props.size][props.tone === "outline" ? "outline" : "filled"],
]);
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap"
    :class="toneClass"
  >
    <slot />
  </span>
</template>
