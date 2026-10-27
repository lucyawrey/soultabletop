<script setup lang="ts">
import type { SheetPreviewTarget } from "#shared/sheet/card";
import type { SheetPreviewMode } from "#shared/sheet/registry";
import type { ValidatedElement } from "#shared/sheet/validate";

// A value with `preview` (Ref, Value, or Column): the value (the slot) as an
// underlined button. `expand` asks its tag (or Table row) to show the preview
// below it; `card` opens it in a card floating under the value, closed by
// clicking again, clicking elsewhere, or Escape. The card flips above the
// value when there's more room there, and scrolls when it's taller than the
// room on either side.
defineProps<{
  mode: SheetPreviewMode;
  target: SheetPreviewTarget;
  card?: ValidatedElement;
  // Expanded now (`expand` only).
  open?: boolean;
  // What a `card` lines up with, when not the value itself (a boxed Ref's box).
  anchor?: HTMLElement | null;
  // The button's accessible name, when its slot is only an icon.
  label?: string;
  // A custom entry being edited: the card shows its fields as inputs.
  editable?: boolean;
}>();
defineEmits<{ toggle: [] }>();
// Classes (like `sheet-name-link`) go on the button, in both modes.
defineOptions({ inheritAttrs: false });

// A name with its icon, or an icon alone: no underline; the icon is muted
// until hovered or open. Its click area reaches a little past it.
const triggerClass =
  "sheet-preview-trigger relative inline-flex cursor-pointer items-center gap-[3px] rounded text-left after:absolute after:-inset-x-[3px] after:-inset-y-1 hover:text-primary hover:bg-primary/7 aria-expanded:bg-primary/10 [&_.iconify]:text-muted hover:[&_.iconify]:text-primary";
</script>

<template>
  <UPopover
    v-if="mode === 'card'"
    :reference="anchor ?? undefined"
    :content="{ side: 'bottom', align: 'start', collisionPadding: 8 }"
  >
    <button type="button" v-bind="$attrs" :class="triggerClass" :aria-label="label">
      <slot />
    </button>
    <template #content>
      <div
        class="sheet-preview-frame max-h-[min(30rem,var(--reka-popover-content-available-height,70vh))] w-[min(340px,calc(100vw-2rem))] overflow-y-auto p-3"
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
        <SheetPreviewEditor v-if="editable" :target="target" />
        <SheetPreviewBody v-else :target="target" :card="card" />
      </div>
    </template>
  </UPopover>
  <button
    v-else
    v-bind="$attrs"
    type="button"
    :class="triggerClass"
    :aria-label="label"
    :aria-expanded="open"
    @click="$emit('toggle')"
  >
    <slot />
  </button>
</template>
