<script setup lang="ts">
// A system's name as a link to its page. Shows "Unknown" (no link) for a
// system the viewer can't read, and nothing while the systems load.
const props = defineProps<{ systemId: string | null | undefined }>();

const { findSystem, systemLabel } = useSystems();
const system = computed(() => findSystem(props.systemId));
</script>

<template>
  <NuxtLink
    v-if="system"
    :to="`/systems/${system.id}`"
    class="text-primary hover:underline"
  >
    {{ system.name }}
  </NuxtLink>
  <span v-else>{{ systemLabel(systemId) }}</span>
</template>
