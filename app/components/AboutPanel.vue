<script setup lang="ts">
// The "About" facts panel beside a detail page's main panels (owner, ID,
// visibility, updated). It stacks below them on phones. Facts with no value
// are left out.
defineProps<{ facts: { label: string; value?: string | null }[] }>();
</script>

<template>
  <aside
    class="rounded-lg border border-default bg-default p-4 print:hidden"
    aria-labelledby="about-heading"
  >
    <h2 id="about-heading" class="mb-3 text-lg font-semibold text-highlighted">
      About
    </h2>
    <dl class="space-y-3 text-sm">
      <template v-for="fact in facts" :key="fact.label">
        <div v-if="fact.value">
          <dt class="text-xs font-semibold tracking-wide text-muted uppercase">
            {{ fact.label }}
          </dt>
          <dd class="break-words text-default">{{ fact.value }}</dd>
        </div>
      </template>
      <slot />
    </dl>
  </aside>
</template>
