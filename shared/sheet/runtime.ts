// Reading Content data for a rendered Sheet: resolving validated paths
// against the data (following references into loaded Content), and formatting
// values as text. Framework-free so it can be unit-tested.

import {
  choiceLabel,
  fieldOptions,
  isReservedKey,
  type ContentFieldSchema,
  type ResourceLinkKind,
} from "../content-schema";
import {
  FormulaError,
  formulaLimits,
  isFormulaError,
  type FormulaNode,
  type FormulaValue,
} from "./formula";
import {
  callFormulaDefinition,
  evaluateFormula,
  evaluateFormulaNode,
  formulaBudget,
  type FormulaEnv,
} from "./formula-eval";
import { formatFormulaNumber } from "./formula-functions";
import type { TextPart } from "./parser";
import {
  findRef,
  isRecord,
  type SheetRefs,
  type SheetScope,
} from "./scope";
import {
  isCompiledFormula,
  type AttrValue,
  type SheetComputedField,
  type SheetDefinition,
  type SheetSchemas,
} from "./validate";

export {
  entryScopes,
  findRef,
  itemScopes,
  ownProperty,
  refRecord,
  resolveSheetPath,
  type SheetEntry,
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
// on the way (an array when the next key is a number). Mutates `root`.
// `undefined` removes the key (an override going back to automatic). Writes
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
  const last = path.at(-1)!;
  // `undefined` removes the key, so the saved data has no trace of it.
  if (value === undefined && !Array.isArray(container)) Reflect.deleteProperty(container, last);
  else container[last] = value;
}

// A starting value for a new field or List item: empty values, with required
// entries of structs and local Content filled in, and choice fields at their
// first option.
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
  const options = fieldOptions(field);
  if (options?.length) return options[0]!.value;
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

// The sheet's `<Define>`s, for formulas that call them.
export interface SheetFormulaDefinitions {
  definitions: ReadonlyMap<string, SheetDefinition>;
  // Steps per evaluation (ValidationResult.stepBudget); maxSteps if missing.
  stepBudget?: number;
  // The value of a definition without parameters, if it is cached (the
  // renderer computes each once).
  cached?: (name: string) => FormulaValue | undefined;
  // Override fields at the top level by path (ValidationResult.computedFields):
  // a formula that reads one with nothing stored gets its computed value.
  computedFields?: ReadonlyMap<string, SheetComputedField>;
}

const noDefinitions: SheetFormulaDefinitions = { definitions: new Map() };

function formulaEnv(
  root: SheetScope,
  scope: SheetScope,
  refs: SheetRefs,
  formulas: SheetFormulaDefinitions,
): FormulaEnv {
  return {
    root,
    scope,
    refs,
    budget: { steps: formulas.stepBudget ?? formulaBudget().steps },
    hasDefinition: (name) => formulas.definitions.has(name),
    call(name, args) {
      const definition = formulas.definitions.get(name);
      if (!definition) return undefined;
      if (definition.broken || !definition.ast) {
        return new FormulaError("definition", `${name} has errors; fix its <Define>`);
      }
      // Not inside a computed field: a cached value computed from that field
      // could be the one being computed, and the cycle would go unnoticed.
      if (!definition.params.length && !this.computing?.size) {
        const cached = formulas.cached?.(name);
        if (cached !== undefined) return cached;
      }
      return callFormulaDefinition({ params: definition.params, ast: definition.ast }, args, this);
    },
    computedField(path, stored, env) {
      const field = formulas.computedFields?.get(path.join("."));
      if (!field || !sheetOverride(field.tag, stored, null).automatic) return undefined;
      const key = path.join(".");
      if (env.computing?.has(key)) {
        return new FormulaError("formula-cycle", `${key} is computed from itself`);
      }
      const depth = env.depth ?? 0;
      if (depth >= formulaLimits.maxCallDepth) {
        return new FormulaError(
          "too-deep",
          `Computed values depend on each other more than ${formulaLimits.maxCallDepth} levels deep`,
        );
      }
      return evaluateFormulaNode(field.ast, {
        ...env,
        scope: root,
        params: undefined,
        depth: depth + 1,
        computing: new Set([...(env.computing ?? []), key]),
      });
    },
  };
}

// A formula's value in `scope`. Never throws.
export function evaluateSheetFormula(
  ast: FormulaNode,
  root: SheetScope,
  scope: SheetScope,
  refs: SheetRefs,
  formulas: SheetFormulaDefinitions = noDefinitions,
): FormulaValue {
  return evaluateFormula(ast, formulaEnv(root, scope, refs, formulas));
}

// The value of a definition without parameters, as calls see it (it may be a
// list). Never throws.
export function evaluateSheetDefinition(
  name: string,
  root: SheetScope,
  refs: SheetRefs,
  formulas: SheetFormulaDefinitions,
): FormulaValue {
  const env = formulaEnv(root, root, refs, {
    definitions: formulas.definitions,
    stepBudget: formulas.stepBudget,
    computedFields: formulas.computedFields,
  });
  try {
    return env.call(name, []) ?? null;
  } catch {
    return new FormulaError("internal", "This formula couldn't be computed");
  }
}

// One piece of rendered text; `error` is set where a formula failed (its
// text is "—").
export interface SheetTextSegment {
  text: string;
  error?: string;
}

export function sheetTextSegments(
  parts: TextPart[],
  root: SheetScope,
  scope: SheetScope,
  refs: SheetRefs,
  formulas: SheetFormulaDefinitions = noDefinitions,
): SheetTextSegment[] {
  return parts.map((part) => {
    if (typeof part === "string") return { text: part };
    if (!part.ast) return { text: "—", error: "This formula has errors" };
    const value = evaluateSheetFormula(part.ast, root, scope, refs, formulas);
    if (isFormulaError(value)) return { text: "—", error: value.message };
    // `{path}` to a choice field shows the option's label.
    const label = part.options && choiceLabel(part.options, value);
    return { text: label ?? formatFormulaValue(value, refs) };
  });
}

export function interpolateSheetText(
  parts: TextPart[],
  root: SheetScope,
  scope: SheetScope,
  refs: SheetRefs,
  formulas: SheetFormulaDefinitions = noDefinitions,
): string {
  return sheetTextSegments(parts, root, scope, refs, formulas)
    .map((segment) => segment.text)
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

// Whether a tag with `show` is shown: true shows it, false or nothing hides
// it. A formula that fails (or a value that isn't true or false) shows the
// tag, so a typo never hides content, with the problem in `error`.
export function sheetCondition(
  condition: AttrValue | undefined,
  root: SheetScope,
  scope: SheetScope,
  refs: SheetRefs,
  formulas: SheetFormulaDefinitions = noDefinitions,
): { shown: boolean; error?: string } {
  if (condition === undefined) return { shown: true };
  if (!isCompiledFormula(condition)) return { shown: true };
  const value = evaluateSheetFormula(condition.ast, root, scope, refs, formulas);
  if (isFormulaError(value)) return { shown: true, error: value.message };
  if (value === true) return { shown: true };
  if (value === false || value === null || value === undefined) return { shown: false };
  return { shown: true, error: "show needs true or false" };
}

// An override field (a field tag with both `field` and `formula`): with no
// stored value (missing, null, or empty text on a Text tag) it is automatic
// and shows the computed value; otherwise the stored value wins.
export function sheetOverride(
  tag: string,
  stored: unknown,
  computed: FormulaValue | undefined,
): { automatic: boolean; value: unknown } {
  const automatic =
    computed !== undefined &&
    (stored === undefined || stored === null || (tag === "Text" && stored === ""));
  if (!automatic) return { automatic, value: stored };
  return { automatic, value: isFormulaError(computed) ? undefined : computed };
}
