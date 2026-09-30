<script setup lang="ts">
import {
  RESOURCE_SOURCE_LABELS,
  type ResourceSource,
} from "#shared/resource-list";

// Where a resource comes from, relative to the viewer (`source` on list rows).
defineProps<{ source: ResourceSource }>();

const colors = {
  you: "success",
  yourGroups: "success",
  shared: "info",
  official: "primary",
  community: "neutral",
} as const;
</script>

<template>
  <UBadge :color="colors[source]" variant="subtle">
    {{ RESOURCE_SOURCE_LABELS[source] }}
  </UBadge>
</template>
