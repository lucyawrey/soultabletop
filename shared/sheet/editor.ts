// Helpers for the Sheet editor: schema-derived field paths for autocomplete
// and the reference panel, sample data for the preview, and where formulas
// are in markup (for completion and highlighting).

import {
  fieldOptions,
  MAX_CONTENT_DEPTH,
  type ContentFieldSchema,
  type ContentTypeSchema,
} from "../content-schema";
import { formulaLimits, lexFormula } from "./formula";
import { resolveFormulaCall } from "./formula-functions";
import { humanizeFieldName } from "./registry";
import type { SheetSchemas } from "./validate";

export interface SheetFieldPath {
  path: string;
  type: string;
  label: string;
}

function typeName(field: ContentFieldSchema): string {
  if (field.type === "array") return `list of ${typeName(field.itemType)}`;
  return field.type;
}

// Every path a Sheet can bind at the top level: fields, fields of objects, and
// fields of referenced ContentTypes (up to MAX_CONTENT_DEPTH hops). Paths
// inside arrays are relative to their List item, so they're listed with a
// `[]` marker (e.g. "attacks[].name") to show where a List goes.
export function sheetFieldPaths(schemas: SheetSchemas): SheetFieldPath[] {
  const paths: SheetFieldPath[] = [{ path: "name", type: "string", label: "Name" }];
  const visit = (schema: ContentTypeSchema, prefix: string, depth: number) => {
    for (const [key, field] of Object.entries(schema)) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.push({
        path,
        type: typeName(field),
        label: field.label ?? humanizeFieldName(key),
      });
      visitField(field, path, depth);
    }
  };
  const visitField = (field: ContentFieldSchema, path: string, depth: number) => {
    if (field.type === "struct") visit(field.entries, path, depth);
    else if (field.type === "array") visitField(field.itemType, `${path}[]`, depth);
    else if (field.type === "content" && depth < MAX_CONTENT_DEPTH) {
      const rules = schemas.types[field.contentTypeId];
      if (!rules) return;
      paths.push({ path: `${path}.name`, type: "string", label: "Name" });
      visit(rules.schema, path, depth + 1);
    }
  };
  visit(schemas.root.schema, "", 0);
  return paths;
}

// Plausible data for previewing a Sheet without real Content.
export function sampleSheetData(schemas: SheetSchemas): Record<string, unknown> {
  const sample = (field: ContentFieldSchema, key: string, depth: number): unknown => {
    const label = field.label ?? humanizeFieldName(key);
    const options = fieldOptions(field);
    if (options?.length) return options[0]!.value;
    switch (field.type) {
      case "string":
        return `Sample ${label.toLowerCase()}`;
      case "number":
        return 10;
      case "boolean":
        return true;
      case "scalar":
        return label;
      case "resourceLink":
        return undefined;
      case "array":
        return depth > 4
          ? []
          : [1, 2].map((index) => sample(field.itemType, `${key} ${index}`, depth + 1));
      case "struct":
        return record(field.entries, depth + 1);
      case "object":
        return { example: label };
      case "content": {
        const rules = schemas.types[field.contentTypeId];
        return {
          name: `Sample ${label}`,
          ...(rules && depth < 4 ? record(rules.schema, depth + 1) : {}),
        };
      }
    }
  };
  const record = (schema: ContentTypeSchema, depth: number) =>
    Object.fromEntries(
      Object.entries(schema)
        .map(([key, field]) => [key, sample(field, key, depth)] as const)
        .filter(([, value]) => value !== undefined),
    );
  return { name: "Sample Name", ...record(schemas.root.schema, 0) };
}

// A formula in markup: the expression of a `formula="…"` or `show="…"`
// attribute or of a `{…}` (without the braces). `params` are the parameters of
// the `<Define>` it belongs to. An unclosed `{` runs to the end of its line.
export interface MarkupFormulaRange {
  from: number;
  to: number;
  params: string[];
}

const tagStart = /<([A-Za-z][A-Za-z0-9]*)/y;
const attributeStart = /([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(["'])/y;
const paramsAttribute = /\bparams\s*=\s*(["'])(.*?)\1/s;

// The `}` that ends a `{…}` formula body starting at `from` (skipping quoted
// text), or -1.
function formulaClose(doc: string, from: number, end: number) {
  end = Math.min(end, from + formulaLimits.maxLength + 1);
  let index = from;
  while (index < end) {
    const char = doc[index]!;
    if (char === "}") return index;
    if (char === "<" && doc[index + 1] === "/" && /[A-Za-z]/.test(doc[index + 2] ?? "")) return -1;
    if (char === "'" || char === "\"") {
      index += 1;
      while (index < end && doc[index] !== char) index += doc[index] === "\\" ? 2 : 1;
    }
    index += 1;
  }
  return -1;
}

// `{…}` formulas between `from` and `end`.
function interpolatedFormulas(doc: string, from: number, end: number, ranges: MarkupFormulaRange[]) {
  let index = from;
  while (index < end) {
    if (doc[index] === "\\") {
      index += 2;
      continue;
    }
    if (doc[index] === "{") {
      const close = formulaClose(doc, index + 1, end);
      const lineEnd = doc.indexOf("\n", index);
      const stop = close === -1 ? (lineEnd === -1 || lineEnd > end ? end : lineEnd) : close;
      ranges.push({ from: index + 1, to: stop, params: [] });
      index = close === -1 ? stop : close + 1;
      continue;
    }
    index += 1;
  }
}

export function markupFormulaRanges(doc: string): MarkupFormulaRange[] {
  const ranges: MarkupFormulaRange[] = [];
  let index = 0;
  let textStart = 0;
  while (index < doc.length) {
    if (doc.startsWith("<!--", index)) {
      interpolatedFormulas(doc, textStart, index, ranges);
      const close = doc.indexOf("-->", index + 4);
      index = close === -1 ? doc.length : close + 3;
      textStart = index;
      continue;
    }
    tagStart.lastIndex = index;
    const tag = doc[index] === "<" ? tagStart.exec(doc) : null;
    if (!tag) {
      // Skip `{…}` in text whole, so a < inside isn't read as a tag.
      if (doc[index] === "{") {
        const close = formulaClose(doc, index + 1, doc.length);
        if (close !== -1) {
          index = close + 1;
          continue;
        }
      }
      index += 1;
      continue;
    }
    interpolatedFormulas(doc, textStart, index, ranges);
    // Attributes up to the tag's `>`.
    const isDefine = tag[1]!.toLowerCase() === "define";
    const tagRanges: MarkupFormulaRange[] = [];
    let cursor = index + tag[0].length;
    while (cursor < doc.length && doc[cursor] !== ">" && doc[cursor] !== "<") {
      attributeStart.lastIndex = cursor;
      const attribute = attributeStart.exec(doc);
      if (!attribute) {
        cursor += 1;
        continue;
      }
      const valueStart = cursor + attribute[0].length;
      const close = doc.indexOf(attribute[2]!, valueStart);
      const valueEnd = close === -1 ? doc.length : close;
      if (["formula", "show"].includes(attribute[1]!.toLowerCase())) {
        tagRanges.push({ from: valueStart, to: valueEnd, params: [] });
      } else {
        interpolatedFormulas(doc, valueStart, valueEnd, tagRanges);
      }
      cursor = valueEnd + 1;
    }
    if (isDefine) {
      const params = paramsAttribute.exec(doc.slice(index, cursor))?.[2];
      const names = params ? params.split(",").map((name) => name.trim()).filter(Boolean) : [];
      for (const range of tagRanges) range.params = names;
    }
    ranges.push(...tagRanges);
    // A tag missing its ">" ends where the next one starts.
    index = doc[cursor] === "<" ? cursor : cursor + 1;
    textStart = index;
  }
  interpolatedFormulas(doc, textStart, doc.length, ranges);
  return ranges.sort((a, b) => a.from - b.from);
}

export type FormulaHighlight = "builtin" | "define" | "param";

// Names in a formula to color: built-in functions, the sheet's definitions,
// and parameters. Offsets are relative to `source`.
export function formulaHighlights(
  source: string,
  params: readonly string[],
  definitions: ReadonlySet<string>,
): { from: number; to: number; kind: FormulaHighlight }[] {
  const tokens = lexFormula(source);
  const highlights: { from: number; to: number; kind: FormulaHighlight }[] = [];
  tokens.forEach((token, index) => {
    if (token.type !== "word") return;
    const isCall = tokens[index + 1]?.text === "(";
    if (isCall) {
      const target = resolveFormulaCall(token.text, (name) => definitions.has(name));
      if (target === "builtin") highlights.push({ from: token.from, to: token.to, kind: "builtin" });
      if (target === "definition") highlights.push({ from: token.from, to: token.to, kind: "define" });
    } else if (params.includes(token.text)) {
      highlights.push({ from: token.from, to: token.to, kind: "param" });
    }
  });
  return highlights;
}
