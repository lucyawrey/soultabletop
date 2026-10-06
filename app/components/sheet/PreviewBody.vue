<script setup lang="ts">
import { generatedCard, type SheetPreviewTarget } from "#shared/sheet/card";
import type { ValidatedElement } from "#shared/sheet/validate";

// What a reference preview shows, expanded or in a card: the tag's `<Preview>`
// (styled by this sheet's CSS); without one, the `<Preview>` beside `<Sheet>`
// in the content type's default sheet (styled by that sheet's CSS, loaded on
// first use); without either, a view generated from the content type's
// schema. Always read-only.
const props = defineProps<{
  target: SheetPreviewTarget;
  card?: ValidatedElement;
  // Rendered inside the content type's own sheet: `card` is its own
  // `<Preview>`, so there's nothing more to load.
  own?: boolean;
}>();

const { context, condition } = useSheet();
provideSheetReadOnly();

// A `<Preview>` hidden by its `show` gives way to the next one.
const card = computed(() => {
  const written = props.card;
  return written && condition(written.attrs.show, props.target.scope).shown ? written : undefined;
});
const ownPreview = computed(() =>
  card.value || props.own ? undefined : context.ownPreview(props.target.contentTypeId).value,
);
// When it is this sheet's own, the sheet's CSS is already on the page (and
// in the Sheet editor, newer than the saved copy).
const ownCss = computed(() =>
  ownPreview.value?.status === "ready" && ownPreview.value.sheet.id !== context.scopeId.value
    ? ownPreview.value.sheet.css
    : undefined,
);
const generated = computed(() =>
  card.value || (ownPreview.value && ownPreview.value.status !== "none")
    ? undefined
    : generatedCard(
        context.schemas.value.types[props.target.contentTypeId]?.schema ?? {},
        props.target.record,
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
</script>

<template>
  <!-- Carries the sheet's scope, so its CSS applies even outside the sheet
    (a card floats outside it). Spaced tightly at any density, like the
    generated view. -->
  <div
    v-if="card"
    :class="[sheetClasses(card), 'space-y-2 text-sm']"
    :data-sheet="context.scopeId.value"
    :data-density="context.density.value"
  >
    <SheetScope :scope="target.scope">
      <SheetNodes :nodes="card.children" />
    </SheetScope>
  </div>

  <p v-else-if="ownPreview?.status === 'loading'" class="text-sm text-dimmed">Loading…</p>

  <SheetRenderer
    v-else-if="ownPreview?.status === 'ready'"
    :markup="ownPreview.sheet.markup"
    :schemas="ownPreview.schemas"
    :data="target.record"
    :refs="context.refs.value"
    :links="context.links.value"
    :css="ownCss"
    :scope-id="ownPreview.sheet.id"
    :default-display="ownPreview.sheet.defaultDisplay"
    :preview-of="target"
  />

  <div v-else-if="generated" class="sheet-preview space-y-2 text-sm">
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
</template>
