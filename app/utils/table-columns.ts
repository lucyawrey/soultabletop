import type { TableColumn } from "@nuxt/ui";

// A column header only screen readers see. An empty header leaves the column
// unnamed (axe's empty-table-header).
export function srOnlyHeader(text: string) {
  return () => h("span", { class: "sr-only" }, text);
}

// The row actions column, with a header for screen readers.
export function actionsColumn<T>(
  column: Partial<TableColumn<T>> = {},
): TableColumn<T> {
  return {
    id: "actions",
    header: srOnlyHeader("Actions"),
    ...column,
  } as TableColumn<T>;
}
