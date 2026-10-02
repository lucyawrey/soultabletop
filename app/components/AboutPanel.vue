<script setup lang="ts">
// The "About" facts panel beside a detail page's main panels (owner, ID,
// visibility, updated). It stacks below them on phones. Facts with no value
// are left out.
defineProps<{ facts: { label: string; value?: string | null }[] }>();
</script>

<template>
  <DetailPanel title="About" class="print:hidden">
    <dl class="px-[18px] pt-1.5 pb-3.5 text-sm">
      <template v-for="fact in facts" :key="fact.label">
        <div
          v-if="fact.value"
          class="flex justify-between gap-3 border-b border-dashed border-default py-2.5 last:border-b-0"
        >
          <dt class="text-muted">{{ fact.label }}</dt>
          <dd class="text-end font-semibold break-words text-default">
            {{ fact.value }}
          </dd>
        </div>
      </template>
      <slot />
    </dl>
  </DetailPanel>
</template>
