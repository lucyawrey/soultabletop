<script setup lang="ts">
defineProps<{ isPubliclyReadable: boolean }>();
</script>

<template>
  <!-- Public is a gilt chip, Limited a dashed outline: not color alone. -->
  <UBadge
    :color="isPubliclyReadable ? 'secondary' : 'neutral'"
    :variant="isPubliclyReadable ? 'subtle' : 'outline'"
    class="rounded-full font-bold"
    :class="isPubliclyReadable ? '' : 'border border-dashed ring-0'"
  >
    {{ visibilityLabel(isPubliclyReadable) }}
  </UBadge>
</template>
