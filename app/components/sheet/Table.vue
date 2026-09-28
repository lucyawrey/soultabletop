<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import type { SheetScope } from "#shared/sheet/runtime";
import type { ValidatedElement } from "#shared/sheet/validate";

// <Table>: one row per item of the bound array, one column per <Column>,
// and an expandable row per item when there is a <RowDetails>.
const props = defineProps<{ node: ValidatedElement }>();

const { items } = useSheet();
const attrText = useSheetAttrText();

const label = computed(() => attrText(props.node.attrs.label));
const rows = computed(() => items(props.node.binding!.path));
const columnNodes = computed(() =>
  props.node.children.filter(
    (child): child is ValidatedElement =>
      child.type === "element" && child.tag === "Column",
  ),
);
const details = computed(() =>
  props.node.children.find(
    (child): child is ValidatedElement =>
      child.type === "element" && child.tag === "RowDetails",
  ),
);

const widths: Record<string, string> = {
  xs: "w-16",
  sm: "w-24",
  md: "w-40",
  lg: "w-64",
};

const columns = computed<TableColumn<SheetScope>[]>(() => [
  ...(details.value ? [{ id: "expand", header: "" }] : []),
  ...columnNodes.value.map((column, index) => ({
    id: `c${index}`,
    header:
      attrText(column.attrs.label) || column.binding?.label || "",
    meta: {
      class: {
        th: widths[column.attrs.width as string],
        td: widths[column.attrs.width as string],
      },
    },
  })),
]);
</script>

<template>
  <div :class="[sheetClasses(node), 'space-y-2']">
    <div v-if="label" class="text-xs font-medium text-muted">{{ label }}</div>
    <UTable :data="rows" :columns="columns" class="w-full">
      <template #expand-cell="{ row }">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          :icon="row.getIsExpanded() ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          :aria-label="row.getIsExpanded() ? 'Collapse row' : 'Expand row'"
          @click="row.toggleExpanded()"
        />
      </template>
      <template
        v-for="(column, index) in columnNodes"
        :key="index"
        #[`c${index}-cell`]="{ row }"
      >
        <SheetScope :scope="row.original">
          <SheetNode :node="column" compact />
        </SheetScope>
      </template>
      <template #expanded="{ row }">
        <SheetScope v-if="details" :scope="row.original">
          <div :class="[sheetClasses(details), 'space-y-3']">
            <SheetNodes :nodes="details.children" />
          </div>
        </SheetScope>
      </template>
      <template #empty>
        <span class="text-sm text-dimmed">None</span>
      </template>
    </UTable>
  </div>
</template>
