<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const route = useRoute();
</script>

<template>
  <ContentDetail
    :id="route.params.id as string"
    label="Character"
    list-path="/characters"
    list-label="Characters"
  />
</template>
