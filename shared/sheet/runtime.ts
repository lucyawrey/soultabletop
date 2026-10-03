// Reading Content data for a rendered Sheet: resolving validated paths
// against the data (following references into loaded Content), and formatting
// values as text. Framework-free so it can be unit-tested.

import {
  isReservedKey,
  type ContentFieldSchema,
  type ResourceLinkKind,
} from "../content-schema";
import { isFormulaError, type FormulaValue } from "./formula";
import { formatFormulaNumber } from "./formula-functions";
import { parseSheetPath, type TextPart } from "./parser";
import {
  findRef,
  isRecord,
  resolveSheetPath,
  type SheetRefs,
  type SheetScope,
} from "./scope";
import type { SheetSchemas } from "./validate";

export {
  findRef,
  itemScopes,
  refRecord,
  resolveSheetPath,
  type SheetRef,
  type SheetRefs,
  type SheetScope,
} from "./scope";

// A resource a `resourceLink` field points at, as loaded for the viewer.
export interface SheetLink {
  name: string;
  kind: ResourceLinkKind;
}

export type SheetLinks = Record<string, SheetLink>;

const RESOURCE_PAGES: Record<ResourceLinkKind, string> = {
  system: "/systems",
  campaign: "/campaigns",
  contentType: "/types",
  sheet: "/sheets",
  content: "/content",
};

// The app page of a linked resource.
export function resourceLinkPath(id: string, link: SheetLink) {
  return `${RESOURCE_PAGES[link.kind]}/${id}`;
}

export function formatSheetValue(
  value: unknown,
  refs: SheetRefs,
  format: "plain" | "signed" = "plain",
): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") {
    return format === "signed" && value > 0 ? `+${value}` : String(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return findRef(refs, value)?.name ?? value;
  if (Array.isArray(value))
    return value
      .map((item) => formatSheetValue(item, refs, format))
      .filter(Boolean)
      .join(", ");
  if (isRecord(value) && typeof value.name === "string") return value.name;
  return JSON.stringify(value);
}

// Writes `value` at `path` inside `root`, creating missing objects and arrays
// on the way (an array when the next key is a number). Mutates `root`. Writes
// nothing if the path uses a reserved key, and never follows inherited
// properties.
export function setSheetValue(
  root: Record<string, unknown>,
  path: (string | number)[],
  value: unknown,
) {
  if (!path.length) return;
  if (path.some((key) => typeof key === "string" && isReservedKey(key))) return;
  let container: Record<string | number, unknown> = root;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]!;
    let next = Object.hasOwn(container, key) ? container[key] : undefined;
    if (typeof next !== "object" || next === null) {
      next = typeof path[index + 1] === "number" ? [] : {};
      container[key] = next;
    }
    container = next as Record<string | number, unknown>;
  }
  container[path.at(-1)!] = value;
}

// A starting value for a new field or List item: empty values, with required
// entries of structs and local Content filled in.
export function defaultSheetValue(
  field: ContentFieldSchema | undefined,
  schemas: SheetSchemas,
  depth = 0,
): unknown {
  const fill = (entries: Record<string, ContentFieldSchema>) =>
    Object.fromEntries(
      Object.entries(entries)
        .filter(([, entry]) => entry.required)
        .map(([key, entry]) => [key, defaultSheetValue(entry, schemas, depth + 1)]),
    );
  switch (field?.type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "struct":
      return depth > 8 ? {} : fill(field.entries);
    case "object":
      return {};
    case "content": {
      const rules = schemas.types[field.contentTypeId];
      return {
        name: "",
        ...(rules && depth <= 8 ? fill(rules.schema) : {}),
      };
    }
    default:
      return null;
  }
}

export function interpolateSheetText(
  parts: TextPart[],
  root: SheetScope,
  scope: SheetScope,
  refs: SheetRefs,
): string {
  return parts
    .map((part) =>
      typeof part === "string"
        ? part
        : formatSheetValue(
            resolveSheetPath(parseSheetPath(part.path), root, scope, refs).value,
            refs,
          ),
    )
    .join("");
}

// A formula value as text: numbers without floating-point noise, references
// as their names. Errors show as an empty string; callers show "—".
export function formatFormulaValue(
  value: FormulaValue,
  refs: SheetRefs,
  format: "plain" | "signed" = "plain",
): string {
  if (isFormulaError(value)) return "";
  if (typeof value === "number") {
    const text = formatFormulaNumber(value);
    return format === "signed" && value > 0 ? `+${text}` : text;
  }
  return formatSheetValue(value, refs, format);
}
