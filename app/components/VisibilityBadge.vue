<script setup lang="ts">
defineProps<{ isPubliclyReadable: boolean }>();
</script>

<template>
  <UBadge
    :color="isPubliclyReadable ? 'primary' : 'neutral'"
    variant="subtle"
  >
    {{ visibilityLabel(isPubliclyReadable) }}
  </UBadge>
</template>
