<script setup lang="ts">
// A resource's readable ID as a small monospace chip. With `owner` (the
// owner's readable ID or username) it shows the full address, `owner/id`.
defineProps<{ readableId: string; owner?: string | null }>();
</script>

<template>
  <span
    :title="`ID: ${readableId}`"
    class="inline-block max-w-full rounded-sm bg-elevated px-[7px] py-[3px] font-mono text-xs leading-tight font-medium [overflow-wrap:anywhere] text-muted"
  >
    <!-- Long addresses wrap after the slash before anywhere else. -->
    <template v-if="owner">{{ owner }}/<wbr></template>{{ readableId }}
  </span>
</template>
