<script setup lang="ts">
// Why a formula shows "—", for people who can edit the sheet.
defineProps<{ message: string }>();
</script>

<template>
  <UIcon
    name="i-lucide-triangle-alert"
    class="sheet-formula-warning ms-0.5 inline-block size-3.5 align-middle text-warning"
    :title="message"
    role="img"
    :aria-label="`Formula problem: ${message}`"
  />
</template>
