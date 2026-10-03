// Reading Content data for a rendered Sheet: resolving validated paths
// against the data (following references into loaded Content), and formatting
// values as text. Framework-free so it can be unit-tested.

import {
  isReservedKey,
  type ContentFieldSchema,
  type ResourceLinkKind,
} from "../content-schema";
import type { TextPart } from "./parser";
import {
  parseSheetPath,
  type SheetPath,
  type SheetSchemas,
} from "./validate";

export interface SheetRef {
  name: string;
  contentTypeId: string;
  data: Record<string, unknown>;
}

export type SheetRefs = Record<string, SheetRef>;

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

// A value in the rendered data, and where it lives. `path` is its location in
// the Content's own data (for editing), or null when it was reached through a
// reference to other Content, which is read-only here.
export interface SheetScope {
  value: unknown;
  path: (string | number)[] | null;
  // A reference on the way was not loaded (missing, or not readable).
  unavailable?: boolean;
}

const indexPattern = /^\d+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Referenced Content as the record a Sheet sees: its data plus `name`.
export function refRecord(ref: SheetRef): Record<string, unknown> {
  return { ...ref.data, name: ref.name };
}

export function resolveSheetPath(
  path: SheetPath,
  root: SheetScope,
  scope: SheetScope,
  refs: SheetRefs,
): SheetScope {
  let current = path.absolute ? root : scope;
  for (const segment of path.segments) {
    if (current.unavailable) return current;
    let container = current.value;
    let containerPath = current.path;
    // A string where fields are expected is a reference to other Content.
    if (typeof container === "string") {
      const ref = refs[container];
      if (!ref) return { value: undefined, path: null, unavailable: true };
      container = refRecord(ref);
      containerPath = null;
    }
    const key = Array.isArray(container) && indexPattern.test(segment)
      ? Number(segment)
      : segment;
    const value =
      Array.isArray(container) && typeof key === "number"
        ? container[key]
        : isRecord(container) && Object.hasOwn(container, segment)
          ? container[segment]
          : undefined;
    current = { value, path: containerPath ? [...containerPath, key] : null };
  }
  return current;
}

// Each item of an array value, as the scope for a List or Table row.
export function itemScopes(list: SheetScope): SheetScope[] {
  if (!Array.isArray(list.value)) return [];
  return list.value.map((value, index) => ({
    value,
    path: list.path ? [...list.path, index] : null,
  }));
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
  if (typeof value === "string") return refs[value]?.name ?? value;
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
