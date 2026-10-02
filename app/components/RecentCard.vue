<script setup lang="ts">
// A dashboard card for one recent item: an initial disc, the name (the
// card's link), and a detail line such as "GM · Ashen Realms".
defineProps<{ to: string; name: string; detail?: string }>();
</script>

<template>
  <div
    class="relative flex items-center gap-3 rounded-lg border border-default bg-default p-3.5 transition-colors focus-within:ring-2 focus-within:ring-primary hover:border-primary/40"
  >
    <span
      aria-hidden="true"
      class="grid size-[42px] shrink-0 place-items-center rounded-full bg-primary/10 font-display text-xl font-bold text-primary"
    >
      {{ name.charAt(0).toUpperCase() }}
    </span>
    <span class="min-w-0">
      <NuxtLink
        :to="to"
        class="block font-bold break-words text-highlighted after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
      >
        {{ name }}
      </NuxtLink>
      <span v-if="detail" class="block text-[13px] text-muted">{{ detail }}</span>
    </span>
  </div>
</template>
