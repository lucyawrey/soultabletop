<script setup lang="ts">
// Recent rolls: this page visit's rolls, newest first, in a slide-over from
// the content page's Rolls button.
const rolls = useSheetRolls();
</script>

<template>
  <USlideover v-model:open="rolls.drawerOpen.value" side="right" title="Recent rolls" :ui="{ body: 'p-0 sm:p-0' }">
    <template #actions>
      <UButton
        v-if="rolls.entries.value.length"
        label="Clear"
        color="neutral"
        variant="link"
        @click="rolls.clear()"
      />
    </template>
    <template #body>
      <div v-if="rolls.entries.value.length" class="divide-y divide-default">
        <RollEntry v-for="entry in rolls.entries.value" :key="entry.id" :entry="entry" />
      </div>
      <p v-else class="p-4 text-sm text-muted">No rolls yet.</p>
    </template>
  </USlideover>
</template>
