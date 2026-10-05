<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import type { SheetScope } from "#shared/sheet/runtime";
import type { ValidatedElement } from "#shared/sheet/validate";

// <Table>: one row per item of the bound array (or entry of the bound
// struct, with no add, remove, or reorder controls), one column per <Column>,
// and an expandable row per item when there is a <RowDetails>.
const props = defineProps<{ node: ValidatedElement }>();

const { context, rows: tableRows, resolve, condition } = useSheet();
const attrText = useSheetAttrText();

const label = computed(() => attrText(props.node.attrs.label));
const list = computed(() => resolve(props.node.binding!.path));
const rows = computed(() => tableRows(props.node));
const editing = useSheetListEditing(() => props.node, list);
const { unlock, remove, move } = editing;
const editable = computed(() => editing.editable.value && !props.node.entries);
const lockedEditable = computed(() => editing.lockedEditable.value && !props.node.entries);
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

// RowDetails' `show`, per row: a row whose details are hidden can't expand.
const rowDetails = (row: SheetScope) =>
  details.value
    ? condition(details.value.attrs.show, row, rows.value.length)
    : { shown: false };

const widths: Record<string, string> = {
  xs: "w-16",
  sm: "w-24",
  md: "w-40",
  lg: "w-64",
};

const columns = computed<TableColumn<SheetScope>[]>(() => [
  ...(details.value ? [{ id: "expand", header: srOnlyHeader("Details") }] : []),
  ...columnNodes.value.map((column, index) => {
    const text = attrText(column.attrs.label) || column.binding?.label || "";
    return {
      id: `c${index}`,
      // A hidden label is still read out, so the column keeps its name.
      header: column.attrs.hideLabel === true ? srOnlyHeader(text) : text,
      meta: {
        class: {
          th: widths[column.attrs.width as string],
          td: widths[column.attrs.width as string],
        },
      },
    };
  }),
  ...(editable.value
    ? [actionsColumn<SheetScope>({ meta: { class: { td: "w-28 text-right" } } })]
    : []),
]);
</script>

<template>
  <div :class="[sheetClasses(node), 'space-y-2']">
    <div
      v-if="label || lockedEditable"
      class="flex items-center gap-1 text-xs font-medium text-muted"
    >
      <span>{{ label }}</span>
      <UButton
        v-if="lockedEditable"
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Edit ${label || 'table'}`"
        @click="unlock"
      />
    </div>
    <!-- Focusable, so the keyboard can scroll it sideways on phones. -->
    <UTable
      :data="rows"
      :columns="columns"
      class="w-full"
      tabindex="0"
      :aria-label="label || undefined"
    >
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton
            icon="i-lucide-arrow-up"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Move up"
            :disabled="row.index === 0"
            @click="move(row.index, -1)"
          />
          <UButton
            icon="i-lucide-arrow-down"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Move down"
            :disabled="row.index === rows.length - 1"
            @click="move(row.index, 1)"
          />
          <UButton
            icon="i-lucide-trash"
            color="error"
            variant="ghost"
            size="xs"
            aria-label="Remove"
            @click="remove(row.index)"
          />
        </div>
      </template>
      <template #expand-cell="{ row }">
        <UButton
          v-if="rowDetails(row.original).shown"
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
        <SheetScope :scope="row.original" :repeat="rows.length">
          <SheetNode :node="column" compact />
        </SheetScope>
      </template>
      <template #expanded="{ row }">
        <SheetScope
          v-if="details && rowDetails(row.original).shown"
          :scope="row.original"
          :repeat="rows.length"
        >
          <div :class="[sheetClasses(details), 'space-y-3']">
            <SheetFormulaWarning
              v-if="rowDetails(row.original).error && context.showInvalid.value"
              :message="`show: ${rowDetails(row.original).error}`"
            />
            <SheetNodes :nodes="details.children" />
          </div>
        </SheetScope>
      </template>
      <template #empty>
        <span class="text-sm text-dimmed">None</span>
      </template>
    </UTable>
    <SheetListAdd
      v-if="editable"
      :node="node"
      :label="attrText(node.attrs.addLabel) || 'Add row'"
      :list="list"
    />
  </div>
</template>
