<script setup lang="ts">
// The "About" facts panel beside a detail page's main panels (owner, ID,
// visibility, counts, updated). It stacks below them on phones. Facts with no
// value are left out; `mono` shows the value as an ID chip.
defineProps<{
  facts: { label: string; value?: string | number | null; mono?: boolean }[];
}>();
</script>

<template>
  <DetailPanel title="About" class="print:hidden">
    <dl class="px-[18px] pt-1.5 pb-3.5 text-sm">
      <template v-for="fact in facts" :key="fact.label">
        <div
          v-if="fact.value !== undefined && fact.value !== null && fact.value !== ''"
          class="flex items-center justify-between gap-3 border-b border-dashed border-default py-2.5 last:border-b-0"
        >
          <dt class="text-muted">{{ fact.label }}</dt>
          <dd class="min-w-0 text-end font-semibold break-words text-default">
            <ReadableIdBadge v-if="fact.mono" :readable-id="String(fact.value)" />
            <template v-else>{{ fact.value }}</template>
          </dd>
        </div>
      </template>
      <slot />
    </dl>
  </DetailPanel>
</template>
