<script setup lang="ts">
import type { BrokenSheets } from "~/utils/api-error";

// Shown when a ContentType schema change would break existing Sheets; the
// parent resends the save with `confirmBrokenSheets: true` on confirm.
const props = defineProps<{ broken: BrokenSheets; loading?: boolean }>();
const emit = defineEmits<{ confirm: [] }>();

const total = computed(
  () => props.broken.sheets.length + props.broken.hiddenCount,
);
const title = computed(
  () => `Saving will break ${total.value} Sheet${total.value === 1 ? "" : "s"}`,
);
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-lucide-triangle-alert"
    :title="title"
    :actions="[
      {
        label: 'Save anyway',
        color: 'warning',
        loading,
        onClick: () => emit('confirm'),
      },
    ]"
  >
    <template #description>
      <ul class="mt-1 space-y-2">
        <li v-for="sheet in broken.sheets" :key="sheet.id">
          <NuxtLink
            :to="`/sheets/${sheet.id}`"
            target="_blank"
            class="font-medium underline"
          >
            {{ sheet.name }}
          </NuxtLink>
          <ul class="list-disc ps-5 text-xs">
            <li v-for="message in sheet.errors" :key="message">
              {{ message }}
            </li>
          </ul>
        </li>
        <li v-if="broken.hiddenCount">
          {{ broken.sheets.length ? "And " : "" }}{{ broken.hiddenCount }}
          {{ broken.sheets.length ? "other " : "" }}Sheet{{ broken.hiddenCount === 1 ? "" : "s" }}
          you can't see.
        </li>
      </ul>
      <p class="mt-2">
        Broken tags show as placeholders until the Sheets are fixed.
      </p>
    </template>
  </UAlert>
</template>
