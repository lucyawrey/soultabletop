// Reference previews: the content a `preview` opens, and the card generated
// from its schema when the sheet doesn't write one. Framework-free so it can
// be unit-tested. See docs/sheet-system.md, "Reference previews".

import { choiceLabel, fieldOptions, type ContentTypeSchema } from "../content-schema";
import { parseSheetMarkup, type SheetNode } from "./parser";
import { findTag, humanizeFieldName } from "./registry";
import {
  findRef,
  formatSheetValue,
  isRecord,
  refRecord,
  resolveSheetPath,
  type SheetRefs,
  type SheetScope,
} from "./runtime";
import type { ValidatedElement, ValidatedNode } from "./validate";

// What a card shows: the referenced (or local) content as a row scope for a
// `<Preview>`'s paths, and as a record for the generated card.
export interface SheetPreviewTarget {
  scope: SheetScope;
  record: Record<string, unknown>;
  name: string;
  contentTypeId: string;
  // The referenced content's ID; none for local data.
  id?: string;
}

// The content a tag's `preview` opens here, or undefined when there's
// nothing to show (no value, or a reference that isn't loaded).
export function sheetPreviewTarget(
  node: ValidatedElement,
  root: SheetScope,
  scope: SheetScope,
  refs: SheetRefs,
): SheetPreviewTarget | undefined {
  if (!node.preview) return undefined;
  const target = resolveSheetPath(node.preview.path, root, scope, refs);
  if (target.unavailable) return undefined;
  const { value } = target;
  if (typeof value === "string") {
    const ref = findRef(refs, value);
    if (!ref) return undefined;
    return {
      scope: target,
      record: refRecord(ref),
      name: ref.name,
      contentTypeId: ref.contentTypeId,
      id: value,
    };
  }
  if (!isRecord(value)) return undefined;
  return {
    scope: target,
    record: value,
    name: typeof value.name === "string" ? value.name : "",
    contentTypeId: node.preview.contentTypeId,
  };
}

const isPreview = (node: SheetNode | ValidatedNode) =>
  node.type === "element" && findTag(node.tag)?.name === "Preview";

// A content type's own `<Preview>`: the one beside `<Sheet>` in its sheet.
export function sheetOwnPreview(nodes: ValidatedNode[]): ValidatedElement | undefined {
  const found = nodes.find(isPreview);
  return found?.type === "element" ? found : undefined;
}

// Whether markup has a `<Preview>` beside `<Sheet>`, without validating it
// (the server sends a type's sheet for previews only when it has one).
export function markupHasOwnPreview(markup: string) {
  return parseSheetMarkup(markup).nodes.some(isPreview);
}

// Text longer than this (or with a line break) is shown as Markdown under
// the rows instead of as a row.
export const CARD_ROW_MAX_LENGTH = 120;

export interface GeneratedCard {
  // Arrays of text or choices, as chips.
  tags: { label: string; values: string[] }[];
  // Other top-level values with something in them, as label and text.
  rows: { label: string; text: string }[];
  // Long text, as Markdown.
  texts: { label: string; markdown: string }[];
}

// The card of content without a `<Preview>`: from the top-level fields of its
// schema, in schema order. Structs, free-form objects, and arrays of anything
// but text or choices are left out; so are empty values.
export function generatedCard(
  schema: ContentTypeSchema,
  record: Record<string, unknown>,
  refs: SheetRefs,
): GeneratedCard {
  const card: GeneratedCard = { tags: [], rows: [], texts: [] };
  for (const [key, field] of Object.entries(schema)) {
    if (!Object.hasOwn(record, key)) continue;
    const value = record[key];
    const label = field.label ?? humanizeFieldName(key);
    if (field.type === "array") {
      const item = field.itemType;
      if (item.type !== "string" && !fieldOptions(item)) continue;
      const options = fieldOptions(item);
      const values = (Array.isArray(value) ? value : [])
        .map((entry) => (options ? choiceLabel(options, entry) : undefined) ?? formatSheetValue(entry, {}))
        .filter(Boolean);
      if (values.length) card.tags.push({ label, values });
      continue;
    }
    if (field.type === "struct" || field.type === "object" || field.type === "resourceLink") continue;
    if (value === undefined || value === null || value === "") continue;
    const options = fieldOptions(field);
    const choice = options ? choiceLabel(options, value) : undefined;
    if (choice !== undefined) {
      card.rows.push({ label, text: choice });
      continue;
    }
    if (field.type === "content") {
      const name =
        typeof value === "string" ? findRef(refs, value)?.name : isRecord(value) ? value.name : undefined;
      if (typeof name === "string" && name) card.rows.push({ label, text: name });
      continue;
    }
    if (typeof value === "string" && (value.length > CARD_ROW_MAX_LENGTH || value.includes("\n"))) {
      card.texts.push({ label, markdown: value });
      continue;
    }
    if (typeof value === "object") continue;
    card.rows.push({ label, text: formatSheetValue(value, {}) });
  }
  return card;
}
