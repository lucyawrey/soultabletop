<script setup lang="ts">
import { generatedCard } from "#shared/sheet/card";
import type { SheetDensity } from "#shared/sheet/registry";

// The reference preview card at the bottom right: the content a `preview`
// tag opened, as the tag's `<Card>` (styled by this sheet's CSS) or, without
// one, a card generated from the content type's schema. Always read-only.
// Close or Escape closes it, and focus goes back to the tag that opened it.
const props = defineProps<{
  preview: SheetPreview;
  scopeId?: string;
  density: SheetDensity;
}>();
const emit = defineEmits<{ close: [] }>();

const { context, condition } = useSheet();
provideSheetReadOnly();

const target = computed(() => props.preview.target);
// A `<Card>` hidden by its `show` gives way to the generated card.
const card = computed(() => {
  const written = props.preview.card;
  return written && condition(written.attrs.show, target.value.scope).shown ? written : undefined;
});
const generated = computed(() =>
  card.value
    ? undefined
    : generatedCard(
        context.schemas.value.types[target.value.contentTypeId]?.schema ?? {},
        target.value.record,
        context.refs.value,
      ),
);
const generatedEmpty = computed(
  () =>
    !!generated.value &&
    !generated.value.tags.length &&
    !generated.value.rows.length &&
    !generated.value.texts.length,
);

const panel = ref<HTMLElement>();
let opener: HTMLElement | null = null;
onMounted(() => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  panel.value?.focus();
});
function close() {
  emit("close");
  opener?.focus();
}
defineShortcuts({ escape: { usingInput: true, handler: close } });
</script>

<template>
  <div
    ref="panel"
    role="dialog"
    :aria-label="target.name || 'Preview'"
    tabindex="-1"
    class="sheet-preview fixed right-4 bottom-4 z-50 max-h-[calc(100dvh-2rem)] w-[min(340px,calc(100vw-2rem))] overflow-y-auto rounded-md border border-accented bg-default p-3 shadow-lg outline-none"
  >
    <div class="mb-2 flex items-start justify-between gap-2">
      <h3 class="font-display text-[22px] leading-tight font-semibold text-highlighted">
        {{ target.name || "—" }}
      </h3>
      <div class="flex shrink-0 items-center gap-1">
        <UButton
          v-if="target.id"
          :to="`/content/${target.id}`"
          label="Open"
          color="neutral"
          variant="ghost"
          size="xs"
        />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Close"
          @click="close"
        />
      </div>
    </div>

    <div
      v-if="card"
      :class="[sheetClasses(card), density === 'compact' ? 'space-y-2 text-sm' : 'space-y-4']"
      :data-sheet="scopeId"
      :data-density="density"
    >
      <SheetScope :scope="target.scope">
        <SheetNodes :nodes="card.children" />
      </SheetScope>
    </div>

    <div v-else-if="generated" class="sheet-card space-y-2 text-sm">
      <div
        v-for="tag in generated.tags"
        :key="tag.label"
        class="flex flex-wrap items-center gap-1"
      >
        <span class="sr-only">{{ tag.label }}:</span>
        <UBadge
          v-for="(value, index) in tag.values"
          :key="index"
          color="neutral"
          variant="subtle"
          :label="value"
        />
      </div>
      <dl
        v-if="generated.rows.length"
        class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5"
      >
        <template v-for="row in generated.rows" :key="row.label">
          <dt class="font-semibold">{{ row.label }}</dt>
          <dd>{{ row.text }}</dd>
        </template>
      </dl>
      <div v-for="text in generated.texts" :key="text.label">
        <h4 class="text-[0.6875rem] font-semibold tracking-wide text-muted uppercase">
          {{ text.label }}
        </h4>
        <UEditor
          :model-value="text.markdown"
          content-type="markdown"
          :editable="false"
          :image="false"
          :mention="false"
          :ui="{ base: 'px-0 sm:px-0' }"
        />
      </div>
      <p v-if="generatedEmpty" class="text-dimmed">Nothing else to show.</p>
    </div>
  </div>
</template>
