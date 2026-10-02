<script setup lang="ts">
import {
  RESOURCE_SOURCE_LABELS,
  type ResourceSource,
} from "#shared/resource-list";

// Where a resource comes from, relative to the viewer (`source` on list rows).
defineProps<{ source: ResourceSource }>();

</script>

<template>
  <!-- Official stands out (solid primary); everything else is a quiet chip. -->
  <UBadge
    :color="source === 'official' ? 'primary' : 'neutral'"
    :variant="source === 'official' ? 'solid' : 'subtle'"
    class="rounded-full font-bold"
  >
    {{ RESOURCE_SOURCE_LABELS[source] }}
  </UBadge>
</template>
