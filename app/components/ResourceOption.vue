<script setup lang="ts">
import type { ResourceOptionItem } from "~/utils/resource-option";

// An option's content in a resource dropdown or picker (`#item-label` slot of
// `USelect`/`USelectMenu`): name, system, and source badge.
// Options without a name (like "Generated") show their label.
defineProps<{
  option: Partial<ResourceOptionItem>;
}>();
</script>

<template>
  <span class="flex min-w-0 items-center gap-2">
    <span class="truncate">{{ option.name ?? option.label }}</span>
    <span v-if="option.systemName" class="shrink-0 text-xs text-muted">
      {{ option.systemName }}
    </span>
    <SourceBadge v-if="option.source" :source="option.source" size="sm" class="shrink-0" />
  </span>
</template>
