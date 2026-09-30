<script setup lang="ts">
// Official resources are owned by a system group; everything else is
// Community.
defineProps<{ official: boolean }>();
</script>

<template>
  <UBadge :color="official ? 'primary' : 'neutral'" variant="subtle">
    {{ official ? "Official" : "Community" }}
  </UBadge>
</template>
