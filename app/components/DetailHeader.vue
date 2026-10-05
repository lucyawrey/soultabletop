<script setup lang="ts">
import type { ResourceSource } from "#shared/resource-list";

// The top of a resource's detail page: a back link, the kind as a small
// eyebrow, the name in the display font, the resource's system under it
// (`systemId`, for kinds that belong to one), a meta row of badges (the
// Source badge, then `#meta`), and the page's buttons (`#actions`, usually
// Edit and Delete as outline buttons).
defineProps<{
  backTo: string;
  // "Back to Systems"
  backLabel: string;
  // The kind, singular, Title Case: "System".
  eyebrow: string;
  title: string;
  systemId?: string;
  source?: ResourceSource;
}>();
</script>

<template>
  <div class="space-y-5">
    <UButton
      :to="backTo"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      class="px-0 text-[15px] font-medium print:hidden"
    >
      {{ backLabel }}
    </UButton>
    <header class="space-y-2">
      <p class="text-xs font-bold tracking-widest text-muted uppercase">
        {{ eyebrow }}
      </p>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="text-[32px] leading-[1.05] font-bold break-words text-highlighted sm:text-[40px]">
          {{ title }}
        </h1>
        <div
          v-if="$slots.actions"
          class="flex flex-wrap items-center gap-2 print:hidden"
        >
          <slot name="actions" />
        </div>
      </div>
      <p v-if="systemId" class="text-[15px] text-muted">
        System: <SystemLink :system-id="systemId" />
      </p>
      <div v-if="source || $slots.meta" class="flex flex-wrap items-center gap-2">
        <SourceBadge v-if="source" :source="source" />
        <slot name="meta" />
      </div>
    </header>
    <OrnamentRule />
  </div>
</template>
