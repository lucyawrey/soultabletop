<script setup lang="ts">
// An expanded reference preview, under the value that opened it (or under
// its Table row): the preview, with a link to the referenced content.
defineProps<{ preview: SheetPreview }>();
</script>

<template>
  <div class="sheet-preview relative rounded-md border border-default bg-elevated/50 p-2">
    <UButton
      v-if="preview.target.id"
      :to="`/content/${preview.target.id}`"
      label="Open"
      color="neutral"
      variant="ghost"
      size="xs"
      class="float-right -mt-1 -mr-1 ml-2"
    />
    <SheetPreviewBody :target="preview.target" :card="preview.card" />
  </div>
</template>
