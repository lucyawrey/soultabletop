<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

// Every field tag (Text, Number, Field, Column, ...), in view mode.
const props = defineProps<{ node: ValidatedElement; compact?: boolean }>();

const { context, resolve, format, number } = useSheet();
const attrText = useSheetAttrText();

const resolved = computed(() => resolve(props.node.binding!.path));
const value = computed(() => resolved.value.value);
const label = computed(
  () => attrText(props.node.attrs.label) || props.node.binding?.label || "",
);

// How to show the value: the tag's own display, or for <Field> and <Column>
// one picked from the schema type.
type Display =
  | "text"
  | "number"
  | "stat"
  | "boolean"
  | "tags"
  | "tracker"
  | "ref"
  | "value"
  | "markdown"
  | "image";

const display = computed<Display>(() => {
  const { tag, attrs, binding } = props.node;
  switch (tag) {
    case "Text":
    case "Select":
      return "text";
    case "Number":
      return attrs.variant === "stat" ? "stat" : "number";
    case "Checkbox":
    case "Toggle":
      return "boolean";
    case "Tags":
      return "tags";
    case "Tracker":
      return "tracker";
    case "Ref":
      return "ref";
    case "Markdown":
      return "markdown";
    case "Image":
      return "image";
    case "Value":
      return "value";
  }
  switch (binding?.field?.type) {
    case "string":
      return "text";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "resourceRef":
    case "content":
      return "ref";
    case "array":
      return "tags";
    default:
      return "value";
  }
});

const text = computed(() =>
  format(value.value, props.node.attrs.format === "signed" ? "signed" : "plain"),
);

const tags = computed(() =>
  Array.isArray(value.value)
    ? value.value.map((item) => format(item)).filter(Boolean)
    : [],
);

const trackerMax = computed(() => number(props.node.attrs.max) ?? 0);
const trackerValue = computed(() =>
  typeof value.value === "number" ? value.value : 0,
);
// Pips are capped so a large max can't render thousands of boxes.
const pips = computed(() =>
  Array.from({ length: Math.min(trackerMax.value, 50) }, (_, index) => index),
);

// A reference to other Content (id), local Content data (object), or a
// Resource link (id).
const refInfo = computed(() => {
  const current = value.value;
  if (typeof current === "string") {
    const ref = context.refs.value[current];
    if (ref) return { name: ref.name, to: `/content/${current}` };
    if (props.node.binding?.field?.type === "resourceRef")
      return { name: current, to: undefined };
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
  <div :class="[sheetClasses(node), display === 'stat' ? 'text-center' : '']">
    <div
      v-if="label && !compact && display !== 'stat'"
      class="text-xs font-medium text-muted"
    >
      {{ label }}
    </div>

    <span v-if="resolved.unavailable" class="text-sm text-dimmed">
      Unavailable
    </span>

    <template v-else-if="display === 'stat'">
      <div class="text-3xl font-bold text-highlighted tabular-nums">
        {{ text || "—" }}
      </div>
      <div v-if="label && !compact" class="text-xs font-medium uppercase text-muted">
        {{ label }}
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

    <div v-else-if="display === 'tags'" class="flex flex-wrap gap-1">
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

    <template v-else-if="display === 'ref'">
      <NuxtLink
        v-if="refInfo?.to"
        :to="refInfo.to"
        class="text-primary hover:underline"
      >
        {{ refInfo.name }}
      </NuxtLink>
      <span v-else-if="refInfo" :class="refInfo.muted ? 'text-dimmed' : ''">
        {{ refInfo.name }}
        <span v-if="refInfo.custom" class="text-xs text-muted">(custom)</span>
      </span>
      <span v-else class="text-dimmed">—</span>
    </template>

    <p v-else-if="display === 'markdown'" class="whitespace-pre-wrap">
      {{ text || "—" }}
    </p>

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

    <span v-else :class="text ? '' : 'text-dimmed'">{{ text || "—" }}</span>
  </div>
</template>
