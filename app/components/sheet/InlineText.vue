<script setup lang="ts">
import type { SheetTextSegment } from "#shared/sheet/runtime";

// Text from Sheet markup. A formula that failed shows "—", plus a warning
// icon with the message for people who can edit the sheet.
defineProps<{ segments: SheetTextSegment[] }>();

const { context } = useSheet();
</script>

<template>
  <template v-for="(segment, index) in segments" :key="index">
    <template v-if="segment.error">
      {{ segment.text }}<SheetFormulaWarning
        v-if="context.showInvalid.value"
        :message="segment.error"
      />
    </template>
    <template v-else>{{ segment.text }}</template>
  </template>
</template>
