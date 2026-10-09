<script setup lang="ts">
import {
  RESOURCE_SOURCE_LABELS,
  type ResourceSource,
} from "#shared/resource-list";

// Where a resource comes from, relative to the viewer (`source` on list rows).
defineProps<{ source: ResourceSource; size?: "md" | "sm" }>();
</script>

<template>
  <!-- Official stands out (solid primary); everything else is a quiet chip. -->
  <LabelChip :tone="source === 'official' ? 'primary' : 'neutral'" :size="size">
    {{ RESOURCE_SOURCE_LABELS[source] }}
  </LabelChip>
</template>
