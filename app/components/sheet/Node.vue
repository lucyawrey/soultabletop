<script setup lang="ts">
import type { Component } from "vue";
import type { ValidatedNode } from "#shared/sheet/validate";
import SheetBadge from "./Badge.vue";
import SheetButton from "./Button.vue";
import SheetCallout from "./Callout.vue";
import SheetCollapsible from "./Collapsible.vue";
import SheetColumnButtons from "./ColumnButtons.vue";
import SheetDivider from "./Divider.vue";
import SheetField from "./Field.vue";
import SheetGrid from "./Grid.vue";
import SheetHeading from "./Heading.vue";
import SheetList from "./List.vue";
import SheetNote from "./Note.vue";
import SheetSection from "./Section.vue";
import SheetStack from "./Stack.vue";
import SheetTable from "./Table.vue";
import SheetTabs from "./Tabs.vue";
import SheetWrapper from "./Wrapper.vue";

// One node of a validated Sheet tree. `compact` drops field labels (Table
// cells).
const props = defineProps<{ node: ValidatedNode; compact?: boolean }>();

const { context, segments, condition } = useSheet();
provideSheetFlags(() => props.node);

// Tags not listed here (Tab, Column, RowDetails, Set) are rendered by their
// parent, or not at all.
const components: Record<string, Component> = {
  Sheet: SheetWrapper,
  Section: SheetSection,
  Grid: SheetGrid,
  Stack: SheetStack,
  Tabs: SheetTabs,
  Divider: SheetDivider,
  Heading: SheetHeading,
  Note: SheetNote,
  Callout: SheetCallout,
  Badge: SheetBadge,
  Collapsible: SheetCollapsible,
  Button: SheetButton,
  List: SheetList,
  Table: SheetTable,
};

// `show`: hidden tags render nothing (their data is kept).
const visibility = computed(() =>
  props.node.type === "element" ? condition(props.node.attrs.show) : { shown: true },
);

const component = computed(() => {
  if (props.node.type !== "element") return undefined;
  if (props.node.tag === "Column" && props.node.children.length) return SheetColumnButtons;
  if (props.node.spec.category === "field") return SheetField;
  return components[props.node.tag];
});
</script>

<template>
  <p v-if="node.type === 'text'" class="sheet-text">
    <SheetInlineText :segments="segments(node.parts)" />
  </p>
  <div
    v-else-if="node.type === 'invalid'"
    v-show="context.showInvalid.value"
    class="sheet-invalid flex items-start gap-2 rounded-md border border-dashed border-warning p-2 text-xs text-warning"
    :title="`Line ${node.loc.start.line}`"
  >
    <UIcon name="i-lucide-triangle-alert" class="size-4 shrink-0" />
    <span>{{ node.message }} (line {{ node.loc.start.line }})</span>
  </div>
  <template v-else-if="component && visibility.shown">
    <SheetFormulaWarning
      v-if="visibility.error && context.showInvalid.value"
      :message="`show: ${visibility.error}`"
    />
    <component :is="component" :node="node" :compact="compact" />
  </template>
</template>
