<script setup lang="ts">
// "Natural 20" / "Natural 1": when exactly one die is kept and the roll marks
// it critical (filled) or a fumble (outlined).
defineProps<{ entry: SheetRollLogEntry }>();
</script>

<template>
  <span
    v-if="entry.naturalMark && entry.natural !== null"
    class="rounded border px-1.5 py-px text-[10.5px] font-bold tracking-wide whitespace-nowrap uppercase"
    :class="entry.naturalMark === 'crit' ? 'border-primary bg-primary text-inverted' : 'border-primary text-primary'"
  >
    Natural {{ entry.natural }}
  </span>
</template>
