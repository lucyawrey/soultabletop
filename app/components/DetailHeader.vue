<script setup lang="ts">
import type { ResourceSource } from "#shared/resource-list";
import type { ForkedFrom } from "#shared/forked-from";
import { resourceLinkPath } from "#shared/sheet/runtime";

// The top of a resource's detail page: a back link, the kind as a small
// eyebrow, the name in the display font, the resource's system under it
// (`systemId`, for kinds that belong to one), what it was forked from
// (`forkedFrom`, as single GETs return it), a meta row of badges (the
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
  forkedFrom?: ForkedFrom;
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
      <p v-if="forkedFrom" class="text-[15px] text-muted">
        <template v-if="forkedFrom.available">
          Forked from
          <NuxtLink
            :to="resourceLinkPath(forkedFrom.id, forkedFrom)"
            class="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            {{ forkedFrom.name }}
          </NuxtLink>
        </template>
        <template v-else>Forked from a resource that's no longer available</template>
      </p>
      <div v-if="source || $slots.meta" class="flex flex-wrap items-center gap-2">
        <SourceBadge v-if="source" :source="source" />
        <slot name="meta" />
      </div>
    </header>
    <OrnamentRule />
  </div>
</template>
