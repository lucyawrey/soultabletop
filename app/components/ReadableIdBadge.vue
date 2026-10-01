<script setup lang="ts">
// A resource's readable ID, shown as a small rounded pill beside its name.
defineProps<{ readableId: string }>();
</script>

<template>
  <UBadge
    color="neutral"
    variant="outline"
    size="sm"
    title="ID"
    class="font-mono font-normal"
  >
    {{ readableId }}
  </UBadge>
</template>
