<script setup lang="ts">
// A resource's readable ID, shown as a small monospace chip beside its name.
defineProps<{ readableId: string }>();
</script>

<template>
  <span
    :title="`ID: ${readableId}`"
    class="inline-block max-w-full rounded-sm bg-muted px-[7px] py-[3px] font-mono text-xs leading-tight font-medium break-all text-muted"
  >
    {{ readableId }}
  </span>
</template>
