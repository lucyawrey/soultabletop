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
}

const indexPattern = /^\d+$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The loaded Content an ID refers to (own entries only).
export function findRef(refs: SheetRefs, id: string): SheetRef | undefined {
  return Object.hasOwn(refs, id) ? refs[id] : undefined;
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

