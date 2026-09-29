<script setup lang="ts">
import type { SheetLink, SheetRef } from "#shared/sheet/runtime";
import { defaultSheetValue, refRecord } from "#shared/sheet/runtime";
import type { ValidatedElement } from "#shared/sheet/validate";

// The editing control of a field tag (see Field.vue for viewing).
const props = defineProps<{
  node: ValidatedElement;
  value: unknown;
  // Where the value lives in the draft data.
  path: (string | number)[];
  label: string;
}>();

const { context, number } = useSheet();
const attrText = useSheetAttrText();

const display = computed(() => sheetFieldDisplay(props.node));
const field = computed(() => props.node.binding?.field);

function set(value: unknown) {
  context.update(props.path, value);
}

const text = computed({
  get: () => (typeof props.value === "string" ? props.value : ""),
  set,
});
const numberValue = computed({
  get: () => (typeof props.value === "number" ? props.value : undefined),
  // Cleared inputs remove the value rather than storing null.
  set: (value: number | null | undefined) => set(value ?? undefined),
});
const booleanValue = computed({
  get: () => props.value === true,
  set: (value: boolean | "indeterminate") => set(value === true),
});
const tags = computed({
  get: () =>
    Array.isArray(props.value)
      ? props.value.filter((item): item is string => typeof item === "string")
      : [],
  set,
});

const placeholder = computed(() => attrText(props.node.attrs.placeholder) || undefined);
const options = computed(() => (props.node.attrs.options as string[] | undefined) ?? []);
const min = computed(() => number(props.node.attrs.min));
const max = computed(() => number(props.node.attrs.max));
const step = computed(() => number(props.node.attrs.step));

// Tracker
const trackerMax = computed(() => Math.max(number(props.node.attrs.max) ?? 0, 0));
const pips = computed(() =>
  Array.from({ length: Math.min(trackerMax.value, 50) }, (_, index) => index),
);
function clickPip(index: number) {
  // Clicking the last filled pip empties it; any other pip fills up to it.
  const current = typeof props.value === "number" ? props.value : 0;
  set(current === index + 1 ? index : index + 1);
}

// Content fields: a reference (ID) or local data (object).
const contentField = computed(() =>
  field.value?.type === "content" ? field.value : undefined,
);
const allow = computed(() => contentField.value?.allow ?? "both");
const isLocal = computed(
  () => typeof props.value === "object" && props.value !== null,
);
const referenced = computed(() =>
  typeof props.value === "string" ? context.refs.value[props.value] : undefined,
);
const localName = computed({
  get: () =>
    isLocal.value
      ? String((props.value as Record<string, unknown>).name ?? "")
      : "",
  set: (name: string) => context.update([...props.path, "name"], name),
});

const linkField = computed(() =>
  field.value?.type === "resourceLink" ? field.value : undefined,
);
const linked = computed(() =>
  typeof props.value === "string" ? context.links.value[props.value] : undefined,
);
function pickLink(id: string, link: SheetLink) {
  context.addLink(id, link);
  set(id);
}

function pick(id: string, ref: SheetRef) {
  context.addRef(id, ref);
  set(id);
}
function makeCustom() {
  set(
    referenced.value
      ? structuredClone(refRecord(referenced.value))
      : defaultSheetValue(contentField.value, context.schemas.value),
  );
}

const imageError = computed(() =>
  text.value && !text.value.startsWith("https://")
    ? "Use an https:// URL"
    : undefined,
);
</script>

<template>
  <UTextarea
    v-if="display === 'text' && node.attrs.multiline === true"
    v-model="text"
    :placeholder="placeholder"
    :aria-label="label"
    autoresize
    class="w-full"
  />
  <UInput
    v-else-if="display === 'text'"
    v-model="text"
    :placeholder="placeholder"
    :aria-label="label"
    class="w-full"
  />

  <USelect
    v-else-if="display === 'select'"
    v-model="text"
    :items="options"
    :aria-label="label"
    class="w-full"
  />

  <UInputNumber
    v-else-if="display === 'number' || display === 'stat'"
    v-model="numberValue"
    :min="min"
    :max="max"
    :step="step"
    :aria-label="label"
    class="w-full"
  />

  <USwitch
    v-else-if="display === 'boolean' && node.tag === 'Toggle'"
    v-model="booleanValue"
    :aria-label="label"
  />
  <UCheckbox
    v-else-if="display === 'boolean'"
    v-model="booleanValue"
    :aria-label="label"
  />

  <UInputTags
    v-else-if="display === 'tags'"
    v-model="tags"
    :aria-label="label"
    class="w-full"
  />

  <div v-else-if="display === 'tracker'" class="space-y-1">
    <div v-if="node.attrs.style === 'pips'" class="flex flex-wrap gap-1">
      <button
        v-for="index in pips"
        :key="index"
        type="button"
        class="size-5 rounded-full border border-primary"
        :class="index < (typeof value === 'number' ? value : 0) ? 'bg-primary' : ''"
        :aria-label="`Set ${label} to ${index + 1}`"
        @click="clickPip(index)"
      />
    </div>
    <UInputNumber
      v-else
      v-model="numberValue"
      :min="0"
      :max="trackerMax"
      :aria-label="label"
      class="w-full"
    />
    <div class="text-xs text-muted tabular-nums">
      {{ typeof value === "number" ? value : 0 }} / {{ trackerMax }}
    </div>
  </div>

  <SheetResourcePicker
    v-else-if="display === 'ref' && linkField"
    :kind="linkField.kind"
    :model-value="typeof value === 'string' ? value : undefined"
    :placeholder="linked?.name ?? 'Choose…'"
    @pick="pickLink"
  />
  <div v-else-if="display === 'ref'" class="space-y-2">
    <UInput
      v-if="isLocal"
      v-model="localName"
      placeholder="Name"
      :aria-label="`${label} name`"
      class="w-full"
    />
    <SheetContentPicker
      v-if="allow !== 'local'"
      :content-type-id="contentField!.contentTypeId"
      :model-value="typeof value === 'string' ? value : undefined"
      :placeholder="referenced?.name ?? (isLocal ? 'Use existing…' : 'Choose…')"
      @pick="pick"
    />
    <div v-if="allow !== 'ref' && !isLocal" class="flex gap-2">
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        :icon="referenced ? 'i-lucide-copy' : 'i-lucide-plus'"
        :label="referenced ? 'Make custom copy' : 'Custom'"
        @click="makeCustom"
      />
    </div>
  </div>

  <div
    v-else-if="display === 'markdown'"
    class="rounded-md border border-default px-3 py-2"
  >
    <UEditor
      v-model="text"
      content-type="markdown"
      :image="false"
      :mention="false"
      :placeholder="placeholder ?? 'Write here…'"
      :aria-label="label"
    />
  </div>

  <UFormField v-else-if="display === 'image'" :error="imageError">
    <UInput
      v-model="text"
      type="url"
      placeholder="https://…"
      :aria-label="label"
      class="w-full"
    />
  </UFormField>
</template>
