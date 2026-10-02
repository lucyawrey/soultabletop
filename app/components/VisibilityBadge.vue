<script setup lang="ts">
defineProps<{ isPubliclyReadable: boolean }>();
</script>

<template>
  <!-- Public is a gilt chip, Limited a dashed outline: not color alone. -->
  <LabelChip :tone="isPubliclyReadable ? 'accent' : 'outline'">
    {{ visibilityLabel(isPubliclyReadable) }}
  </LabelChip>
</template>
