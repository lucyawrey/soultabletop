<script setup lang="ts">
// A value that opens a reference preview card when clicked (`preview` on
// Ref, Value, or Column): the value (the slot) as an underlined button.
defineProps<{ open: boolean }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    class="sheet-preview-trigger cursor-pointer text-left underline decoration-1 underline-offset-2 hover:decoration-2"
    aria-haspopup="dialog"
    :aria-expanded="open"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>
