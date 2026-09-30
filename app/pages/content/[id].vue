<script setup lang="ts">
const route = useRoute();
</script>

<template>
  <ContentDetail
    :id="route.params.id as string"
    label="Content"
    list-path="/content"
    list-label="Content"
  />
</template>
