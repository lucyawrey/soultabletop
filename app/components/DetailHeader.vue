<script setup lang="ts">
// The top of a resource's detail page: a back link, the kind as a small
// eyebrow, the name in the display font, a meta row of badges (`#meta`), and
// the page's buttons (`#actions`, usually Edit and Delete as outline buttons).
defineProps<{
  backTo: string;
  // "Back to Systems"
  backLabel: string;
  // The kind, singular, Title Case: "System".
  eyebrow: string;
  title: string;
}>();
</script>

<template>
  <header class="space-y-3">
    <UButton
      :to="backTo"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      size="sm"
      class="-ms-2.5 print:hidden"
    >
      {{ backLabel }}
    </UButton>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 space-y-2">
        <p class="text-xs font-semibold tracking-wide text-muted uppercase">
          {{ eyebrow }}
        </p>
        <h1 class="text-3xl font-bold text-highlighted break-words">
          {{ title }}
        </h1>
        <div
          v-if="$slots.meta"
          class="flex flex-wrap items-center gap-2"
        >
          <slot name="meta" />
        </div>
      </div>
      <div
        v-if="$slots.actions"
        class="flex flex-wrap items-center gap-2 print:hidden"
      >
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
