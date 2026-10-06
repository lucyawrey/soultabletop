<script setup lang="ts">
import type { SheetPreviewTarget } from "#shared/sheet/card";
import type { SheetPreviewMode } from "#shared/sheet/registry";
import type { ValidatedElement } from "#shared/sheet/validate";

// A value with `preview` (Ref, Value, or Column): the value (the slot) as an
// underlined button. `expand` asks its tag (or Table row) to show the preview
// below it; `card` opens it in a card floating under the value, closed by
// clicking again, clicking elsewhere, or Escape.
defineProps<{
  mode: SheetPreviewMode;
  target: SheetPreviewTarget;
  card?: ValidatedElement;
  // Expanded now (`expand` only).
  open?: boolean;
}>();
defineEmits<{ toggle: [] }>();

const triggerClass =
  "sheet-preview-trigger cursor-pointer text-left underline decoration-1 underline-offset-2 hover:decoration-2";
</script>

<template>
  <UPopover v-if="mode === 'card'" :content="{ side: 'bottom', align: 'start' }">
    <button type="button" :class="triggerClass">
      <slot />
    </button>
    <template #content>
      <div
        class="sheet-preview max-h-[min(30rem,70vh)] w-[min(340px,calc(100vw-2rem))] overflow-y-auto p-3"
        role="group"
        :aria-label="target.name || 'Preview'"
      >
        <div class="mb-2 flex items-start justify-between gap-2">
          <h3 class="font-display text-[22px] leading-tight font-semibold text-highlighted">
            {{ target.name || "—" }}
          </h3>
          <UButton
            v-if="target.id"
            :to="`/content/${target.id}`"
            label="Open"
            color="neutral"
            variant="ghost"
            size="xs"
          />
        </div>
        <SheetPreviewBody :target="target" :card="card" />
      </div>
    </template>
  </UPopover>
  <button
    v-else
    type="button"
    :class="triggerClass"
    :aria-expanded="open"
    @click="$emit('toggle')"
  >
    <slot />
  </button>
</template>
