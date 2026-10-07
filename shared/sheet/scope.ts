// Resolving Sheet paths against Content data, following references into
// loaded Content. Shared by the runtime and the formula evaluator; import it
// through runtime.ts elsewhere.

import type { SheetPath } from "./parser";

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
  // A List or Table row (or the item of a per-item function): its index in an
  // array, or its entry key in a struct, and a struct entry's label. Read by
  // `itemKey()` and `itemLabel()`.
  item?: { key: string | number; label?: string };
}

// One entry of a struct that a List, Table, or per-item function repeats
// over, in schema order (see ValidatedElement.entries).
export interface SheetEntry {
  key: string;
  label: string;
}

const indexPattern = /^\d+$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A record's own property (never an inherited one like `constructor`). Reads
// the property first: Vue tracks that read, so a computed that found the key
// missing reruns when it's added (`Object.hasOwn` alone isn't tracked).
export function ownProperty<T>(record: Record<string, T>, key: string): T | undefined {
  const value = record[key];
  return Object.hasOwn(record, key) ? value : undefined;
}

// The loaded Content an ID refers to (own entries only).
export function findRef(refs: SheetRefs, id: string): SheetRef | undefined {
  return ownProperty(refs, id);
}

// Referenced Content as the record a Sheet sees: its data plus `name`.
export function refRecord(ref: SheetRef): Record<string, unknown> {
  return { ...ref.data, name: ref.name };
}

// What a List or Table row is called, for the roll entries of its actions:
// a struct entry's label, else the row's `name` text, else the name of the
// first loaded Content the row references (a Strike row's weapon).
export function sheetRowTitle(
  item: SheetScope["item"],
  row: unknown,
  refs: SheetRefs,
): string | undefined {
  if (!item) return undefined;
  if (item.label) return item.label;
  if (!isRecord(row)) return undefined;
  if (typeof row.name === "string" && row.name) return row.name;
  for (const value of Object.values(row)) {
    const ref = typeof value === "string" ? findRef(refs, value) : undefined;
    if (ref) return ref.name;
  }
  return undefined;
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
      const ref = findRef(refs, container);
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
          ? ownProperty(container, segment)
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
    item: { key: index },
  }));
}

// Each entry of a struct value, in schema order, as the scope for a row. The
// rows come from the schema, so an entry with nothing stored still gets one
// (writing into it creates the objects on the way).
export function entryScopes(struct: SheetScope, entries: readonly SheetEntry[]): SheetScope[] {
  if (struct.unavailable) return [];
  const container = isRecord(struct.value) ? struct.value : undefined;
  return entries.map(({ key, label }) => ({
    value: container ? ownProperty(container, key) : undefined,
    path: struct.path ? [...struct.path, key] : null,
    item: { key, label },
  }));
}

