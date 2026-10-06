// Tests write most markup without the `<Sheet>` root every sheet needs.
// `compileInSheet` adds it and returns the root's children as the nodes, so a
// test reads its own tags; markup with its own `<Sheet>` compiles as written.
// Wrapping moves columns on the first line by 7 (`<Sheet>`).
import { parseSheetMarkup } from "../parser";
import { compileSheet, type SheetSchemas, type ValidationResult } from "../validate";

const isRoot = (node: { type: string; tag?: string }) =>
  node.type === "element" && node.tag?.toLowerCase() === "sheet";

export function compileInSheet(markup: string, schemas: SheetSchemas): ValidationResult {
  if (parseSheetMarkup(markup).nodes.some(isRoot)) return compileSheet(markup, schemas);
  const result = compileSheet(`<Sheet>${markup}</Sheet>`, schemas);
  const root = result.nodes.find(isRoot);
  return root?.type === "element" ? { ...result, nodes: root.children } : result;
}
