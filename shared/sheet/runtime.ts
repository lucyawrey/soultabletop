// Reading Content data for a rendered Sheet: resolving validated paths
// against the data (following references into loaded Content), and formatting
// values as text. Framework-free so it can be unit-tested.

import type { TextPart } from "./parser";
import { parseSheetPath, type SheetPath } from "./validate";

export interface SheetRef {
  name: string;
  contentTypeId: string;
  data: Record<string, unknown>;
}

export type SheetRefs = Record<string, SheetRef>;

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
        : isRecord(container)
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
