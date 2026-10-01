<script setup lang="ts">
// A system's name as a link to its page. Shows a skeleton while the systems
// load, then "Unknown" (no link) for a system the viewer can't read.
const props = defineProps<{ systemId: string | null | undefined }>();

const { findSystem, status } = useSystems();
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
  <LookupSkeleton v-else-if="isLoading(status)" />
  <span v-else>Unknown</span>
</template>
