<script setup lang="ts">
// A resource's readable ID as a small monospace chip. With `owner` (the
// owner's readable ID or username) it shows the full address, `owner/id`.
defineProps<{ readableId: string; owner?: string | null }>();
</script>

<template>
  <span
    :title="`ID: ${readableId}`"
    class="inline-block max-w-full rounded-sm bg-muted px-[7px] py-[3px] font-mono text-xs leading-tight font-medium break-all text-muted"
  >
    <template v-if="owner">{{ owner }}/</template>{{ readableId }}
  </span>
</template>
