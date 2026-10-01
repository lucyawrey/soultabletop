<script setup lang="ts">
// Inline placeholder for a name that comes from a separate fetch (a content
// type's name in a list cell, a system link in a subtitle). Hidden from
// assistive tech: a page can have dozens, and the surrounding table or page
// already shows its own loading state.
withDefaults(defineProps<{ sizeClass?: string }>(), {
  sizeClass: "h-4 w-24",
});
</script>

<template>
  <span
    aria-hidden="true"
    class="inline-block animate-pulse rounded-md bg-elevated align-middle"
    :class="sizeClass"
  />
</template>
