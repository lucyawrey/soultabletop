<script setup lang="ts">
// A page's title row: an optional small eyebrow above the title and line
// below it, and the page's actions (buttons) at the end. The title is the display font.
// `section` names the page's sidebar group as the eyebrow: Play or Build when
// signed in, Browse when signed out (the sidebar's only group then).
const props = defineProps<{
  title: string;
  eyebrow?: string;
  section?: "play" | "build";
  description?: string;
}>();

const loggedIn = await useLoggedIn();
const eyebrowText = computed(() => {
  if (!props.section) return props.eyebrow;
  if (!loggedIn.value) return "Browse";
  return props.section === "play" ? "Play" : "Build";
});
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <p
        v-if="eyebrowText"
        class="mb-1 text-xs font-bold tracking-[0.1em] text-muted uppercase"
      >
        {{ eyebrowText }}
      </p>
      <h1 class="text-[34px] leading-[1.05] font-bold text-highlighted">
        {{ title }}
      </h1>
      <p v-if="description" class="mt-1 text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="flex print:hidden flex-wrap items-center gap-2">
      <slot />
    </div>
  </div>
</template>
