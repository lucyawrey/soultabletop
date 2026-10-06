<script setup lang="ts">
import { generatedCard, type SheetPreviewTarget } from "#shared/sheet/card";
import type { ValidatedElement } from "#shared/sheet/validate";

// What a reference preview shows, expanded or in a card: the tag's `<Preview>`
// (styled by this sheet's CSS), or without one, a view generated from the
// content type's schema. Always read-only.
const props = defineProps<{
  target: SheetPreviewTarget;
  card?: ValidatedElement;
}>();

const { context, condition } = useSheet();
provideSheetReadOnly();

// A `<Preview>` hidden by its `show` gives way to the generated view.
const card = computed(() => {
  const written = props.card;
  return written && condition(written.attrs.show, props.target.scope).shown ? written : undefined;
});
const generated = computed(() =>
  card.value
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
