<script setup lang="ts">
// A bordered panel on a detail page: a header row with the title in the
// display font and the panel's buttons (`#actions`), then the body. Rows in
// the body (a `<ul class="divide-y divide-default">`) bring their own padding.
defineProps<{ title: string }>();
</script>

<template>
  <section class="rounded-lg border border-default bg-default">
    <header
      class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-[18px] py-3.5"
    >
      <h2 class="font-display text-[22px] leading-tight font-bold text-highlighted">
        {{ title }}
      </h2>
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>
