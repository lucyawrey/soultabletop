<script setup lang="ts">
import { isFormulaError } from "#shared/sheet/formula";
import {
  findRef,
  ownProperty,
  resourceLinkPath,
  sheetOverride,
  type SheetScope,
} from "#shared/sheet/runtime";
import type { ValidatedElement } from "#shared/sheet/validate";

// Every field tag (Text, Number, Field, Column, ...): its value, or its input
// (FieldInput.vue) when editable, or that input disabled when `display="box"`.
// With a `formula`, the value is computed; with a field too (an override),
// the field's value wins when it has one.
const props = defineProps<{ node: ValidatedElement; compact?: boolean }>();

const { context, scope, resolve, format, formatFormula, evaluate, number } = useSheet();
const attrText = useSheetAttrText();

// A formula-only field has no place in the data, so it can't be edited.
const resolved = computed<SheetScope>(() =>
  props.node.binding ? resolve(props.node.binding.path) : { value: undefined, path: null },
);
const computedValue = computed(() =>
  props.node.formula ? evaluate(props.node.formula.ast) : undefined,
);
const formulaError = computed(() =>
  isFormulaError(computedValue.value) ? computedValue.value.message : undefined,
);
// An override with nothing stored (or empty text) shows the computed value.
const stored = computed(() => resolved.value.value);
// `Field` with a formula acts as the tag matching its field's type.
const overrideTag = computed(() => {
  if (props.node.tag !== "Field") return props.node.tag;
  const type = props.node.binding?.field?.type;
  return type === "string" ? "Text" : type === "boolean" ? "Checkbox" : type === "number" ? "Number" : "Field";
});
const override = computed(() =>
  sheetOverride(
    overrideTag.value,
    stored.value,
    computedValue.value,
  ),
);
const automatic = computed(() => override.value.automatic);
const value = computed(() => override.value.value);
// The computed value as text, for the input's placeholder.
const computedText = computed(() =>
  computedValue.value === undefined ? "" : formatFormula(computedValue.value),
);
// `field="."` in a struct entry row is labeled by its row ("Str", "Dex", …).
const rowLabel = computed(() => {
  const path = props.node.binding?.path;
  return path && !path.absolute && !path.segments.length ? scope.value.item?.label : undefined;
});
const label = computed(
  () => attrText(props.node.attrs.label) || props.node.binding?.label || rowLabel.value || "",
);
// `hideLabel` drops the visible label; the label text still names inputs for
// screen readers.
const shownLabel = computed(() =>
  props.node.attrs.hideLabel === true ? "" : label.value,
);
const hint = computed(
  () => attrText(props.node.attrs.hint) || props.node.binding?.description || "",
);

const display = computed(() => sheetFieldDisplay(props.node));

// Fields of unknown type (`any`) are edited with the raw JSON editor.
const { editable, lockedEditable, unlock, boxed } = useSheetEditable(
  () => props.node,
  () => (display.value === "value" ? null : resolved.value.path),
);

// `display="box"` shows a non-editable field as its disabled input. Value tags
// and images keep their normal view, and references show their link in a box
// so they stay clickable.
const boxedView = computed(
  () =>
    !editable.value &&
    boxed.value &&
    !resolved.value.unavailable &&
    display.value !== "value" &&
    display.value !== "image",
);
// Laid out like an input: label above, no stat styling.
const asInput = computed(() => editable.value || boxedView.value);

// The hint sits under editable and boxed inputs only.
const showHint = computed(
  () =>
    !!hint.value &&
    !props.compact &&
    ((editable.value && !!resolved.value.path) ||
      (boxedView.value && display.value !== "ref")),
);
// A stat's label goes under its number.
const showStatLabel = computed(
  () =>
    display.value === "stat" &&
    !asInput.value &&
    !resolved.value.unavailable &&
    !!shownLabel.value &&
    !props.compact,
);

// A choice field shows its option's label; formulas still see the value.
const choiceOptions = computed(() => sheetChoiceOptions(props.node));
const text = computed(() => {
  const signed = props.node.attrs.format === "signed";
  if (automatic.value) return formatFormula(computedValue.value ?? null, signed ? "signed" : "plain");
  return (
    sheetChoiceText(choiceOptions.value, value.value) ??
    format(value.value, signed ? "signed" : "plain")
  );
});
// Shown instead of the value when the formula failed.
const showsError = computed(() => automatic.value && !!formulaError.value);
// An override that holds a manual value can go back to the computed one.
const isEditableOverride = computed(
  () => !!props.node.formula && !!props.node.binding && editable.value,
);
const canReset = computed(() => isEditableOverride.value && !automatic.value);
function useAutomatic() {
  if (resolved.value.path) context.update(resolved.value.path, undefined);
}

const tags = computed(() =>
  Array.isArray(value.value)
    ? value.value
        .map((item) => sheetChoiceText(choiceOptions.value, item) ?? format(item))
        .filter(Boolean)
    : [],
);

// A computed maximum can be anything; keep it a whole number of at least 0.
const trackerMax = computed(() => Math.max(Math.floor(number(props.node.attrs.max) ?? 0), 0));
const trackerValue = computed(() =>
  typeof value.value === "number" ? value.value : 0,
);
// Pips are capped so a large max can't render thousands of boxes.
const pips = computed(() =>
  Array.from({ length: Math.min(trackerMax.value, 50) }, (_, index) => index),
);

// A reference to other Content (id), local Content data (object), or a
// resource link (id).
const refInfo = computed(() => {
  const current = value.value;
  if (typeof current === "string") {
    if (props.node.binding?.field?.type === "resourceLink") {
      const link = ownProperty(context.links.value, current);
      return link
        ? { name: link.name, to: resourceLinkPath(current, link) }
        : { name: "Unavailable", to: undefined, muted: true };
    }
    const ref = findRef(context.refs.value, current);
    if (ref) return { name: ref.name, to: `/content/${current}` };
    return { name: "Unavailable", to: undefined, muted: true };
  }
  if (current && typeof current === "object" && "name" in current)
    return { name: String(current.name), to: undefined, custom: true };
  return undefined;
});

const imageUrl = computed(() =>
  typeof value.value === "string" && value.value.startsWith("https://")
    ? value.value
    : undefined,
);
const imageSizes: Record<string, string> = {
  sm: "max-h-24",
  md: "max-h-48",
  lg: "max-h-80",
  full: "w-full",
};
const imageSize = computed(
  () => imageSizes[(props.node.attrs.size as string | undefined) ?? "md"],
);
</script>

<template>
  <div
    :class="[
      sheetClasses(node),
      display === 'stat' && !asInput ? 'text-center' : '',
    ]"
  >
    <!-- The buttons' negative margin keeps this row at the label's height, so
      showing one doesn't push the input down. An editable override keeps the
      row even without a label, so the reset button coming and going doesn't
      move the input either. -->
    <div
      v-if="(shownLabel && !compact && (display !== 'stat' || asInput)) || lockedEditable || isEditableOverride"
      class="flex min-h-4 items-center gap-1 text-xs font-medium text-muted"
    >
      <span v-if="shownLabel && !compact" class="sheet-field-label">{{
        shownLabel
      }}</span>
      <UButton
        v-if="canReset"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        size="xs"
        class="-my-1"
        aria-label="Use automatic value"
        title="Use automatic value"
        @click="useAutomatic"
      />
      <UButton
        v-if="lockedEditable"
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        size="xs"
        class="-my-1"
        :aria-label="`Edit ${label}`"
        @click="unlock"
      />
    </div>

    <div class="sheet-field-value">
    <template v-if="editable && resolved.path">
      <SheetFieldInput
        :node="node"
        :value="overrideTag === 'Checkbox' ? value : stored"
        :path="resolved.path"
        :label="label"
        :automatic="automatic ? computedText : undefined"
      />
    </template>

    <span v-else-if="showsError" class="tabular-nums">
      —<SheetFormulaWarning
        v-if="context.showInvalid.value"
        :message="formulaError!"
      />
    </span>

    <span v-else-if="resolved.unavailable" class="text-sm text-dimmed">
      Unavailable
    </span>

    <template v-else-if="boxedView && display !== 'ref'">
      <SheetFieldInput
        :node="node"
        :value="value"
        :path="resolved.path ?? []"
        :label="label"
        disabled
      />
    </template>

    <template v-else-if="display === 'stat'">
      <div class="text-3xl font-bold text-highlighted tabular-nums">
        {{ text || "—" }}
      </div>
    </template>

    <span v-else-if="display === 'number'" class="tabular-nums">
      {{ text || "—" }}
    </span>

    <span
      v-else-if="display === 'boolean'"
      class="inline-flex items-center gap-1"
    >
      <UIcon
        :name="value === true ? 'i-lucide-check' : 'i-lucide-x'"
        :class="value === true ? 'text-success' : 'text-dimmed'"
        class="size-4"
      />
      {{ value === true ? "Yes" : "No" }}
    </span>

    <div v-else-if="display === 'tags' || display === 'choices'" class="flex flex-wrap gap-1">
      <UBadge
        v-for="(tag, index) in tags"
        :key="index"
        color="neutral"
        variant="subtle"
        :label="tag"
      />
      <span v-if="!tags.length" class="text-dimmed">—</span>
    </div>

    <div v-else-if="display === 'tracker'" class="space-y-1">
      <div v-if="node.attrs.style === 'pips'" class="flex flex-wrap gap-1">
        <span
          v-for="index in pips"
          :key="index"
          class="size-4 rounded-full border border-primary"
          :class="index < trackerValue ? 'bg-primary' : ''"
        />
      </div>
      <UProgress v-else :model-value="trackerValue" :max="trackerMax || 1" />
      <div class="text-xs text-muted tabular-nums">
        {{ trackerValue }} / {{ trackerMax }}
      </div>
    </div>

    <div
      v-else-if="display === 'ref'"
      :class="
        boxedView
          ? 'min-h-8 rounded-md bg-default px-2.5 py-1.5 text-sm ring ring-accented ring-inset'
          : ''
      "
    >
      <NuxtLink
        v-if="refInfo?.to"
        :to="refInfo.to"
        class="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      >
        {{ refInfo.name }}
      </NuxtLink>
      <span v-else-if="refInfo" :class="refInfo.muted ? 'text-dimmed' : ''">
        {{ refInfo.name }}
        <span v-if="refInfo.custom" class="text-xs text-muted">(custom)</span>
      </span>
      <span v-else class="text-dimmed">—</span>
    </div>

    <template v-else-if="display === 'markdown'">
      <UEditor
        v-if="typeof value === 'string' && value"
        :model-value="value"
        content-type="markdown"
        :editable="false"
        :image="false"
        :mention="false"
      />
      <span v-else class="text-dimmed">—</span>
    </template>

    <template v-else-if="display === 'image'">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="attrText(node.attrs.alt) || label"
        referrerpolicy="no-referrer"
        loading="lazy"
        class="rounded-md object-contain"
        :class="imageSize"
      >
      <span v-else class="text-dimmed">No image</span>
    </template>

    <pre
      v-else-if="display === 'json'"
      class="overflow-x-auto text-xs font-mono"
    >{{ value === undefined ? "—" : JSON.stringify(value, null, 2) }}</pre>

    <span v-else :class="text ? '' : 'text-dimmed'">{{ text || "—" }}</span>
    </div>

    <p v-if="showHint" class="mt-1 text-xs text-dimmed">{{ hint }}</p>
    <div
      v-if="showStatLabel"
      class="sheet-field-label text-xs font-medium uppercase text-muted"
    >
      {{ shownLabel }}
    </div>
  </div>
</template>
