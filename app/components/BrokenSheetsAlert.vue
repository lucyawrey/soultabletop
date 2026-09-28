<script setup lang="ts">
import type { BrokenSheet } from "~/utils/api-error";

// Shown when a ContentType schema change would break existing Sheets; the
// parent resends the save with `confirmBrokenSheets: true` on confirm.
const props = defineProps<{ sheets: BrokenSheet[]; loading?: boolean }>();
const emit = defineEmits<{ confirm: [] }>();

const title = computed(
  () =>
    `Saving will break ${props.sheets.length} Sheet${props.sheets.length === 1 ? "" : "s"}`,
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
        <li v-for="sheet in sheets" :key="sheet.id">
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
      </ul>
      <p class="mt-2">
        Broken tags show as placeholders until the Sheets are fixed.
      </p>
    </template>
  </UAlert>
</template>
