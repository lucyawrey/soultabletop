// Checks parsed Sheet markup against the tag registry and the ContentType
// schema, and turns it into the tree the renderer consumes. Broken tags become
// `invalid` nodes (shown as placeholders to Sheet editors) so the rest of the
// Sheet still renders. Formulas are parsed and type-checked here too. See
// docs/sheet-system.md, section 3.

import {
  isReservedKey,
  MAX_CONTENT_DEPTH,
  NAME_FIELD,
  type ContentFieldSchema,
  type ContentTypeRules,
  type ContentTypeSchema,
} from "../content-schema";
import {
  arrayOf,
  couldBe,
  describeType,
  formulaLimits,
  formulaReservedWords,
  formulaTypes,
  parseFormula,
  scalarType,
  typeMembers,
  unionOf,
  type FormulaBaseKind,
  type FormulaNode,
  type FormulaType,
} from "./formula";
import { checkFormula, type FormulaCheckHost } from "./formula-check";
import { formulaLaterBuiltins, formulaReservedNames } from "./formula-functions";
import {
  invalidPathMessage,
  isValidSheetPath,
  parseSheetMarkup,
  parseSheetPath,
  type Loc,
  type Position,
  type SheetAttr,
  type SheetDiagnostic,
  type SheetElement,
  type SheetNode,
  type SheetPath,
  type TextPart,
} from "./parser";
import {
  commonAttrsFor,
  findTag,
  humanizeFieldName,
  noShowTags,
  type AttrSpec,
  type BindKind,
  type TagSpec,
} from "./registry";

// The Sheet's ContentType plus every ContentType its `content` fields reach
// (up to MAX_CONTENT_DEPTH), keyed by ID.
export interface SheetSchemas {
  root: ContentTypeRules;
  types: Record<string, ContentTypeRules>;
}

export { parseSheetPath, type SheetPath } from "./parser";

export interface Binding {
  path: SheetPath;
  // The schema field, when the schema knows it (not for `any` or unknown paths).
  field?: ContentFieldSchema;
  label: string;
  description?: string;
}

// A valid formula from an attribute: `formula="…"` or `show="…"`, or a number
// attribute given as `{…}`.
export interface CompiledFormula {
  source: string;
  loc: Loc;
  ast: FormulaNode;
  type: FormulaType;
}

export function isCompiledFormula(value: unknown): value is CompiledFormula {
  return typeof value === "object" && value !== null && "ast" in value && "source" in value;
}

export type AttrValue =
  | boolean
  | number
  | string
  | string[]
  | TextPart[] // text attributes
  | CompiledFormula; // `formula` and `show`, and number attributes given as {…}

export interface ValidatedElement {
  type: "element";
  tag: string; // canonical name, e.g. "Section"
  spec: TagSpec;
  attrs: Record<string, AttrValue>;
  binding?: Binding;
  // The tag's `formula`, when it has a valid one.
  formula?: { ast: FormulaNode; type: FormulaType };
  children: ValidatedNode[];
  loc: Loc;
}

export interface ValidatedText {
  type: "text";
  parts: TextPart[];
  loc: Loc;
}

export interface InvalidNode {
  type: "invalid";
  tag: string;
  message: string;
  loc: Loc;
}

export type ValidatedNode = ValidatedElement | ValidatedText | InvalidNode;

// A `<Define>`. `broken` ones (errors, or part of a cycle) have no usable
// body; calling them gives an error value.
export interface SheetDefinition {
  name: string;
  params: string[];
  type: FormulaType;
  ast?: FormulaNode;
  broken: boolean;
  loc: Loc;
}

// An override field (`field` and `formula`) at the top level: formulas that
// read its path while nothing is stored there get this formula's value.
export interface SheetComputedField {
  tag: string;
  ast: FormulaNode;
  source: string;
  loc: Loc;
}

export interface ValidationResult {
  nodes: ValidatedNode[];
  diagnostics: SheetDiagnostic[];
  definitions: ReadonlyMap<string, SheetDefinition>;
  // By path (segments joined with ".").
  computedFields: ReadonlyMap<string, SheetComputedField>;
  // Steps each evaluation of one of this sheet's formulas may take (see
  // formulaLimits.maxSheetSteps).
  stepBudget: number;
}

// The step budget per formula for a sheet with this many formulas.
export function sheetStepBudget(formulaCount: number) {
  return Math.min(
    formulaLimits.maxSteps,
    Math.floor(formulaLimits.maxSheetSteps / Math.max(formulaCount, 1)),
  );
}

// What a path points at. `record` is a set of named fields: the top level, an
// `object` field's entries, or a ContentType reached through a `content` field.
// `depth` counts the `content` fields crossed to get here.
type Shape =
  | {
      kind: "record";
      fields: ContentTypeSchema;
      strict: boolean;
      hasName: boolean;
      depth: number;
    }
  | { kind: "field"; field: ContentFieldSchema; strict: boolean; depth: number }
  | { kind: "unknown"; depth: number };

const nameField: ContentFieldSchema = {
  type: "string",
  required: true,
  label: "Name",
};

const iconPattern = /^i-[a-z0-9]+(?:-[a-z0-9]+)+$/;
const classNamePattern = /^[a-z][a-z0-9-]*$/;
const indexPattern = /^\d+$/;
const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
// Read as dice in formulas (`d6`), so not usable as a name there.
const dicePattern = /^d\d+$/;

function describeField(field: ContentFieldSchema) {
  switch (field.type) {
    case "string":
      return "a text field";
    case "number":
      return "a number field";
    case "boolean":
      return "a boolean field";
    case "scalar":
      return "a scalar field";
    case "array":
      return "an array";
    case "struct":
      return "a struct";
    case "object":
      return "a free-form object";
    case "resourceLink":
      return "a resource link";
    case "content":
      return "a content field";
    default:
      return "a field";
  }
}

function describeShape(shape: Shape) {
  if (shape.kind === "record") return "a struct";
  if (shape.kind === "field") return describeField(shape.field);
  return "an unknown field";
}

// The formula type of a schema field.
function fieldType(field: ContentFieldSchema): FormulaType {
  switch (field.type) {
    case "string":
    case "resourceLink":
      return formulaTypes.string;
    case "number":
      return formulaTypes.number;
    case "boolean":
      return formulaTypes.boolean;
    case "scalar":
      return scalarType;
    case "array":
      return arrayOf(fieldType(field.itemType));
    case "struct":
      return formulaTypes.record;
    case "content":
      // A reference (an ID) or local data.
      return unionOf(formulaTypes.string, formulaTypes.record);
    default:
      // Free-form objects and field types from older schemas.
      return formulaTypes.any;
  }
}

function shapeType(shape: Shape): FormulaType {
  if (shape.kind === "record") return formulaTypes.record;
  if (shape.kind === "field") return fieldType(shape.field);
  return formulaTypes.any;
}

// Whether a type is definitely a list or a group of fields, never one value.
function isCollection(type: FormulaType) {
  return typeMembers(type).every((member) => member.kind === "array" || member.kind === "record");
}

// What a field tag's formula must give.
const formulaResults: Record<string, { kinds: readonly FormulaBaseKind[]; wanted: string }> = {
  Number: { kinds: ["number"], wanted: "a number" },
  Tracker: { kinds: ["number"], wanted: "a number" },
  Text: { kinds: ["string"], wanted: "text" },
  Checkbox: { kinds: ["boolean"], wanted: "true or false" },
  Column: { kinds: ["number", "string", "boolean"], wanted: "a single value" },
};

// The tag a `Field` with a formula acts as, by its field's schema type.
const fieldOverrideTags: Record<string, string> = {
  string: "Text",
  number: "Number",
  boolean: "Checkbox",
};

// Plain attribute text, or undefined if it contains a {…} formula.
function plainText(parts: TextPart[]) {
  if (parts.some((part) => typeof part !== "string")) return undefined;
  return parts.join("");
}

// Whether two parsed formulas are the same, ignoring spacing and parentheses
// (their locations differ, nothing else).
function sameFormula(a: unknown, b: unknown) {
  const withoutLocations = (key: string, value: unknown) => (key === "loc" || key === "nameLoc" ? undefined : value);
  return JSON.stringify(a, withoutLocations) === JSON.stringify(b, withoutLocations);
}

function attrNamed(node: SheetElement, name: string) {
  return node.attrs.find((attr) => attr.name.toLowerCase() === name.toLowerCase());
}

interface DefinitionState extends SheetDefinition {
  source?: string;
  start?: Position;
  status: "pending" | "checking" | "done";
  calls: string[];
}

class Validator {
  readonly diagnostics: SheetDiagnostic[] = [];
  readonly definitions = new Map<string, DefinitionState>();
  readonly computedFields = new Map<string, SheetComputedField>();
  private readonly rootShape: Shape;
  formulaSites = 0;

  constructor(private readonly schemas: SheetSchemas) {
    this.rootShape = {
      kind: "record",
      fields: schemas.root.schema,
      strict: schemas.root.hasStrictSchema,
      hasName: true,
      depth: 0,
    };
  }

  validate(nodes: SheetNode[]): ValidatedNode[] {
    this.collectDefinitions(nodes);
    return this.children(nodes, null, this.rootShape);
  }

  private error(code: string, message: string, loc: Loc) {
    this.diagnostics.push({ severity: "error", code, message, loc });
  }

  private warn(code: string, message: string, loc: Loc) {
    this.diagnostics.push({ severity: "warning", code, message, loc });
  }

  private errorCount() {
    return this.diagnostics.filter((item) => item.severity === "error").length;
  }

  // Warnings about paths the schema doesn't pin down (not in a non-strict
  // schema, or inside a free-form object). The Sheet's own content type
  // decides whether they show; errors are never affected.
  private warnSchema(code: string, message: string, loc: Loc) {
    if (this.schemas.root.showSheetWarnings === true) this.warn(code, message, loc);
  }

  // Paths

  // Turns a `struct` or `content` field into the record of its fields.
  private enter(shape: Shape, path: string, loc: Loc): Shape | undefined {
    if (shape.kind !== "field") return shape;
    const { field } = shape;
    if (field.type === "struct") {
      return {
        kind: "record",
        fields: field.entries,
        strict: shape.strict,
        hasName: false,
        depth: shape.depth,
      };
    }
    if (field.type === "content") {
      const depth = shape.depth + 1;
      if (depth > MAX_CONTENT_DEPTH) {
        this.error(
          "content-too-deep",
          `"${path}" goes through more than ${MAX_CONTENT_DEPTH} content fields`,
          loc,
        );
        return undefined;
      }
      const rules = this.schemas.types[field.contentTypeId];
      if (!rules) {
        this.warn(
          "missing-content-type",
          `"${path}" uses a content type that doesn't exist or couldn't be loaded`,
          loc,
        );
        return { kind: "unknown", depth };
      }
      return {
        kind: "record",
        fields: rules.schema,
        strict: rules.hasStrictSchema,
        hasName: true,
        depth,
      };
    }
    return shape;
  }

  private step(
    from: Shape,
    segment: string,
    walked: string,
    path: string,
    loc: Loc,
  ): Shape | undefined {
    const shape = this.enter(from, walked || path, loc);
    if (!shape || shape.kind === "unknown") return shape;

    if (shape.kind === "record") {
      if (shape.hasName && segment === NAME_FIELD) {
        return { kind: "field", field: nameField, strict: shape.strict, depth: shape.depth };
      }
      const field = Object.hasOwn(shape.fields, segment)
        ? shape.fields[segment]
        : undefined;
      if (field) {
        return { kind: "field", field, strict: shape.strict, depth: shape.depth };
      }
      const where = walked ? `"${walked}"` : "the schema";
      if (shape.strict) {
        this.error("unknown-field", `"${path}": ${where} has no field "${segment}"`, loc);
        return undefined;
      }
      this.warnSchema(
        "unknown-field",
        `"${path}": ${where} has no field "${segment}"; it will show whatever the data holds`,
        loc,
      );
      return { kind: "unknown", depth: shape.depth };
    }

    const { field } = shape;
    if (field.type === "object") {
      this.warnSchema(
        "free-form-path",
        `"${path}": "${walked}" is a free-form object, so "${segment}" isn't checked; it will show whatever the data holds`,
        loc,
      );
      return { kind: "unknown", depth: shape.depth };
    }
    if (field.type === "array") {
      if (indexPattern.test(segment)) {
        return { kind: "field", field: field.itemType, strict: shape.strict, depth: shape.depth };
      }
      this.error(
        "not-an-object",
        `"${path}": "${walked}" is an array; use an index like ${walked}.0, or a <List>`,
        loc,
      );
      return undefined;
    }
    this.error(
      "not-an-object",
      `"${path}": "${walked}" is ${describeField(field)} and has no field "${segment}"`,
      loc,
    );
    return undefined;
  }

  // Resolves a parsed path; `text` is how it is written, for messages.
  private resolvePath(parsed: SheetPath, text: string, scope: Shape, loc: Loc): Shape | undefined {
    let shape: Shape | undefined = parsed.absolute ? this.rootShape : scope;
    const walked: string[] = [];
    for (const segment of parsed.segments) {
      shape = this.step(shape, segment, walked.join("."), text, loc);
      if (!shape) return undefined;
      walked.push(segment);
    }
    return shape;
  }

  private resolve(path: string, scope: Shape, loc: Loc): Shape | undefined {
    return this.resolvePath(parseSheetPath(path), path, scope, loc);
  }

  private bindKinds(shape: Shape): Set<BindKind> | "all" {
    if (shape.kind === "unknown") return "all";
    const kinds = new Set<BindKind>(["anyValue"]);
    if (shape.kind === "record") return kinds;
    const { field } = shape;
    switch (field.type) {
      case "scalar":
      case "object":
        kinds.add(field.type);
        break;
      case "string":
      case "number":
      case "boolean":
      case "resourceLink":
      case "content":
        kinds.add(field.type);
        break;
      case "array": {
        kinds.add("array");
        const item = field.itemType.type;
        if (item === "string") kinds.add("stringArray");
        if (item === "struct" || item === "content" || item === "object")
          kinds.add("objectArray");
        break;
      }
    }
    return kinds;
  }

  // The shape of one item of the array a List or Table is bound to.
  private itemShape(shape: Shape): Shape {
    if (shape.kind === "field" && shape.field.type === "array") {
      return { ...shape, field: shape.field.itemType };
    }
    return { kind: "unknown", depth: shape.depth };
  }

  // Formulas

  private formulaHost(params?: readonly string[]): FormulaCheckHost<Shape> {
    return {
      resolve: (path, text, scope, loc) => {
        const shape = this.resolvePath(path, text, scope, loc);
        return shape && { type: shapeType(shape), scope: shape };
      },
      itemScope: (list) => (list ? this.itemShape(list) : { kind: "unknown", depth: 0 }),
      definition: (name) => {
        const definition = this.definitions.get(name);
        return definition && { params: definition.params, type: this.definitionType(definition) };
      },
      params: params && Object.fromEntries(params.map((name) => [name, formulaTypes.any])),
    };
  }

  // Counts a formula toward the sheet's limit; false (reported once) past it.
  private countFormula(loc: Loc) {
    this.formulaSites += 1;
    if (this.formulaSites <= formulaLimits.maxSites) return true;
    if (this.formulaSites === formulaLimits.maxSites + 1) {
      this.error(
        "formula-too-large",
        `This sheet has more than ${formulaLimits.maxSites.toLocaleString("en-US")} formulas`,
        loc,
      );
    }
    return false;
  }

  // Parses and checks one formula in `scope`. Undefined if it has errors
  // (they are reported).
  private compileFormula(
    source: string,
    start: Position,
    scope: Shape,
    loc: Loc,
  ): CompiledFormula | undefined {
    if (!this.countFormula(loc)) return undefined;
    const parsed = parseFormula(source, start);
    this.diagnostics.push(...parsed.diagnostics);
    if (!parsed.ast) return undefined;
    const before = this.errorCount();
    const checked = checkFormula(parsed.ast, this.formulaHost(), scope);
    this.diagnostics.push(...checked.diagnostics);
    if (this.errorCount() > before) return undefined;
    return { source, loc, ast: parsed.ast, type: checked.type };
  }

  // Text parts with their `{…}` formulas compiled (`ast` set on valid ones).
  private compileParts(parts: TextPart[], scope: Shape): TextPart[] {
    return parts.map((part) => {
      if (typeof part === "string") return part;
      const compiled = this.compileFormula(part.formula, part.bodyStart, scope, part.loc);
      if (!compiled) return part;
      if (isCollection(compiled.type)) {
        this.error(
          "formula-result-type",
          `{${part.formula.trim()}} gives ${describeType(compiled.type)}; text needs a single value`,
          part.loc,
        );
        return part;
      }
      return { ...part, ast: compiled.ast };
    });
  }

  // `<Define>`s: collected before the rest, so order doesn't matter.
  private collectDefinitions(nodes: SheetNode[]) {
    const tagOf = (node: SheetNode) => (node.type === "element" ? node.tag.toLowerCase() : "");
    const candidates: SheetElement[] = [];
    for (const node of nodes) {
      if (node.type !== "element") continue;
      if (tagOf(node) === "define") candidates.push(node);
      if (tagOf(node) !== "sheet") continue;
      for (const child of node.children) {
        if (child.type === "element" && tagOf(child) === "define") candidates.push(child);
      }
    }

    for (const node of candidates) {
      const nameAttr = attrNamed(node, "name");
      const name = nameAttr && nameAttr.value !== true ? plainText(nameAttr.value)?.trim() : undefined;
      // A missing or malformed name is reported with the tag's attributes.
      if (!name || !identifierPattern.test(name) || isReservedKey(name)) {
        this.checkUnusedDefinition(node);
        continue;
      }
      const nameLoc = nameAttr!.valueLoc ?? nameAttr!.loc;
      if (dicePattern.test(name)) {
        this.error("formula-reserved-name", `${name} looks like dice (2d6); choose another name`, nameLoc);
        this.checkUnusedDefinition(node);
        continue;
      }

      if (this.definitions.size >= formulaLimits.maxDefinitions) {
        this.error(
          "formula-too-large",
          `A sheet can have at most ${formulaLimits.maxDefinitions} <Define> tags`,
          node.loc,
        );
        break;
      }
      if (this.definitions.has(name)) {
        this.error("duplicate-definition", `${name} is defined more than once`, nameLoc);
        this.checkUnusedDefinition(node);
        continue;
      }
      if (formulaReservedNames.has(name)) {
        this.error(
          "formula-reserved-name",
          `${name} is a built-in name; choose another name for this definition`,
          nameLoc,
        );
        this.checkUnusedDefinition(node);
        continue;
      }
      if (formulaLaterBuiltins.includes(name)) {
        this.warn(
          "formula-shadows-builtin",
          `${name} is now a built-in function; this sheet's definition is used. Rename it to use the built-in.`,
          nameLoc,
        );
      }

      const params = this.definitionParams(node);
      const formulaAttr = attrNamed(node, "formula");
      this.definitions.set(name, {
        name,
        params: params ?? [],
        type: formulaTypes.any,
        broken: params === undefined || !formulaAttr?.valueLoc,
        loc: nameLoc,
        source: formulaAttr?.raw,
        start: formulaAttr?.valueLoc?.start,
        status: "pending",
        calls: [],
      });
    }

    for (const definition of this.definitions.values()) this.definitionType(definition);
    this.reportCycles();
  }

  // The syntax of a `<Define>` that can't be used (a bad or taken name), so
  // its mistakes still show.
  private checkUnusedDefinition(node: SheetElement) {
    const params = this.definitionParams(node) ?? [];
    const formulaAttr = attrNamed(node, "formula");
    if (formulaAttr?.raw === undefined || !formulaAttr.valueLoc) return;
    this.diagnostics.push(...parseFormula(formulaAttr.raw, formulaAttr.valueLoc.start, { params }).diagnostics);
  }

  // A definition's parameter names, or undefined if they're invalid.
  private definitionParams(node: SheetElement): string[] | undefined {
    const attr = attrNamed(node, "params");
    if (!attr) return [];
    const loc = attr.valueLoc ?? attr.loc;
    const raw = attr.value === true ? undefined : plainText(attr.value);
    if (raw === undefined) return undefined; // reported with the attributes
    const params = raw.split(",").map((item) => item.trim());
    if (params.length > formulaLimits.maxParams) {
      this.error("invalid-attribute", `A definition can have at most ${formulaLimits.maxParams} parameters`, loc);
      return undefined;
    }
    const seen = new Set<string>();
    for (const param of params) {
      let problem: string | undefined;
      if (!identifierPattern.test(param))
        problem = `"${param}" isn't a valid parameter name; use letters, numbers, and underscores, starting with a letter`;
      else if (formulaReservedWords.includes(param) || isReservedKey(param))
        problem = `"${param}" is reserved; choose another parameter name`;
      else if (dicePattern.test(param))
        problem = `"${param}" looks like dice (2d6); choose another parameter name`;
      else if (seen.has(param)) problem = `Parameter "${param}" is listed twice`;
      if (problem) {
        this.error("invalid-attribute", problem, loc);
        return undefined;
      }
      seen.add(param);
    }
    return params;
  }

  // Checks a definition's body (once) and returns its result type. Bodies are
  // checked against the top level, with parameters of any type.
  private definitionType(definition: DefinitionState): FormulaType {
    if (definition.status === "done") return definition.type;
    if (definition.status === "checking") return formulaTypes.any; // a cycle
    definition.status = "checking";
    if (definition.source !== undefined && definition.start && this.countFormula(definition.loc)) {
      const parsed = parseFormula(definition.source, definition.start, { params: definition.params });
      this.diagnostics.push(...parsed.diagnostics);
      if (parsed.ast) {
        const before = this.errorCount();
        const checked = checkFormula(parsed.ast, this.formulaHost(definition.params), this.rootShape);
        this.diagnostics.push(...checked.diagnostics);
        definition.calls = checked.calls;
        definition.type = checked.type;
        if (this.errorCount() === before) definition.ast = parsed.ast;
      }
    }
    if (!definition.ast) definition.broken = true;
    definition.status = "done";
    return definition.type;
  }

  // Definitions that call themselves, directly or through others.
  private reportCycles() {
    // The shortest chain of calls from `from` back to itself.
    const cycleFrom = (from: string): string[] | undefined => {
      const previous = new Map<string, string>();
      const queue: string[] = [];
      for (const name of this.definitions.get(from)?.calls ?? []) {
        if (!previous.has(name)) {
          previous.set(name, from);
          queue.push(name);
        }
      }
      while (queue.length) {
        const current = queue.shift()!;
        if (current === from) {
          const chain = [from];
          let step = previous.get(from)!;
          while (step !== from) {
            chain.unshift(step);
            step = previous.get(step)!;
          }
          return [from, ...chain];
        }
        for (const next of this.definitions.get(current)?.calls ?? []) {
          if (!previous.has(next)) {
            previous.set(next, current);
            queue.push(next);
          }
        }
      }
      return undefined;
    };
    for (const definition of this.definitions.values()) {
      const cycle = cycleFrom(definition.name);
      if (!cycle) continue;
      definition.broken = true;
      this.error(
        "formula-cycle",
        `${definition.name} calls itself: ${cycle.map((name) => `${name}()`).join(" → ")}`,
        definition.loc,
      );
    }
  }

  // Tags

  private children(
    nodes: SheetNode[],
    parent: TagSpec | null,
    scope: Shape,
  ): ValidatedNode[] {
    const rule = parent?.children ?? "any";
    const result: ValidatedNode[] = [];
    for (const node of nodes) {
      if (node.type === "text") {
        if (rule === "none" || typeof rule === "object") {
          this.error("text-not-allowed", `<${parent!.name}> can't contain text`, node.loc);
          continue;
        }
        result.push({ type: "text", parts: this.compileParts(node.parts, scope), loc: node.loc });
        continue;
      }
      result.push(this.element(node, parent, scope));
    }
    return result;
  }

  private element(
    node: SheetElement,
    parent: TagSpec | null,
    scope: Shape,
  ): ValidatedNode {
    const invalid = (code: string, message: string): InvalidNode => {
      this.error(code, message, node.loc);
      return { type: "invalid", tag: node.tag, message, loc: node.loc };
    };
    // Already reported.
    const broken = (message: string): InvalidNode => ({
      type: "invalid",
      tag: node.tag,
      message,
      loc: node.loc,
    });

    const spec = findTag(node.tag);
    if (!spec) return invalid("unknown-tag", `Unknown tag <${node.tag}>`);

    const rule = parent?.children ?? "any";
    if (rule === "none")
      return invalid("child-not-allowed", `<${parent!.name}> can't contain other tags`);
    if (rule === "text")
      return invalid("child-not-allowed", `<${parent!.name}> can only contain text`);
    if (typeof rule === "object" && !rule.only.includes(spec.name)) {
      const allowed = rule.only.map((name) => `<${name}>`).join(" and ");
      return invalid("child-not-allowed", `<${parent!.name}> can only contain ${allowed}`);
    }
    if (spec.parents) {
      if (!spec.parents.length && parent)
        return invalid("misplaced-tag", `<${spec.name}> must be the outermost tag`);
      const allowedHere = parent ? spec.parents.includes(parent.name) : spec.topLevel === true;
      if (spec.parents.length && !allowedHere) {
        const allowed = spec.parents.map((name) => `<${name}>`).join(" or ");
        return invalid(
          "misplaced-tag",
          spec.topLevel
            ? `<${spec.name}> must be at the top level or directly inside ${allowed}`
            : `<${spec.name}> must be directly inside ${allowed}`,
        );
      }
    }

    const attrs = this.attributes(node, spec, scope);
    if (!attrs) return broken(`<${spec.name}> has errors`);

    if (spec.category === "definition") {
      return { type: "element", tag: spec.name, spec, attrs, children: [], loc: node.loc };
    }

    // A formula attribute that didn't compile makes the tag unusable.
    const formulaAttr = attrNamed(node, "formula");
    const formula = isCompiledFormula(attrs.formula) ? attrs.formula : undefined;
    if (formulaAttr && spec.formula && !formula) return broken(`<${spec.name}> has errors`);

    if (spec.category === "field") {
      const hasField = typeof attrs.field === "string";
      // `Field` has no input of its own to compute without a field: its type
      // picks the input.
      if (spec.name === "Field" && formula && !hasField) {
        if (attrNamed(node, "field")) return broken(`<${spec.name}> has errors`);
        return invalid(
          "missing-attribute",
          "<Field> with a formula needs a field attribute; use <Value> to show a computed value",
        );
      }
      if (!hasField && !formula) {
        // A field attribute that was written but is invalid is reported already.
        if (attrNamed(node, "field")) return broken(`<${spec.name}> has errors`);
        return invalid(
          "missing-attribute",
          spec.formula
            ? `<${spec.name}> needs a field or formula attribute`
            : `<${spec.name}> needs a field attribute`,
        );
      }
      if (hasField && formula && spec.formula !== "override") {
        return invalid(
          "invalid-attribute",
          `<${spec.name}> takes field or formula, not both`,
        );
      }
      if (formula && !hasField) {
        for (const flag of ["live", "locked"]) {
          const attr = attrNamed(node, flag);
          if (attr) {
            this.warn(
              "flag-no-effect",
              `${flag} has no effect on <${spec.name}> with a formula and no field: a computed value can't be edited`,
              attr.loc,
            );
          }
        }
      }
    }

    let binding: Binding | undefined;
    let childScope = scope;
    if (typeof attrs.field === "string") {
      const path = attrs.field;
      const shape = this.resolve(path, scope, node.loc);
      if (!shape) return broken(`Can't find field "${path}"`);
      const kinds = this.bindKinds(shape);
      if (kinds !== "all" && !spec.binds?.some((kind) => kinds.has(kind))) {
        const suggestion =
          kinds.has("array") ? "; use <List> or <Table>" :
          shape.kind === "record" || (shape.kind === "field" && shape.field.type === "struct")
            ? "; use a <Section> with fields inside"
            : "";
        return invalid(
          "wrong-field-type",
          `<${spec.name}> can't show "${path}": it's ${describeShape(shape)}${suggestion}`,
        );
      }
      const field = shape.kind === "field" ? shape.field : undefined;
      const parsed = parseSheetPath(path);
      const lastSegment = parsed.segments.at(-1);
      binding = {
        path: parsed,
        field,
        label:
          field?.label ??
          (lastSegment && !indexPattern.test(lastSegment)
            ? humanizeFieldName(lastSegment)
            : ""),
        description: field?.description,
      };
      if (spec.itemScope) childScope = this.itemShape(shape);
    }

    // `Field` with a formula acts as the tag matching its field's type.
    let overrideTag = spec.name;
    if (spec.name === "Field" && formula) {
      overrideTag = fieldOverrideTags[binding?.field?.type ?? ""] ?? "";
      if (!overrideTag) {
        return invalid(
          "invalid-attribute",
          `<Field> takes a formula only on a text, number, or true/false field, but "${attrs.field as string}" ${binding?.field ? `is ${describeField(binding.field)}` : "has no known type"}`,
        );
      }
    }

    if (formula && !this.formulaResultFits(spec, formula, binding, overrideTag)) {
      return broken(`<${spec.name}> has errors`);
    }
    // Inside a List or Table row the formula reads the row, so only top-level
    // overrides can stand in for their field elsewhere.
    if (formula && binding && spec.formula === "override" && scope === this.rootShape) {
      const key = binding.path.segments.join(".");
      const existing = this.computedFields.get(key);
      if (!existing) {
        this.computedFields.set(key, { tag: overrideTag, ast: formula.ast, source: formula.source, loc: node.loc });
      } else if (!sameFormula(existing.ast, formula.ast)) {
        this.error(
          "computed-field-conflict",
          `"${key}" already has a different formula on line ${existing.loc.start.line}; give a field one formula`,
          formula.loc,
        );
      }
    }
    if (formula && binding?.field?.required) {
      this.warn(
        "override-required",
        `"${attrs.field as string}" is required, so going back to the computed value (which clears it) can't be saved; make the field optional`,
        node.loc,
      );
    }

    return {
      type: "element",
      tag: spec.name,
      spec,
      attrs,
      binding,
      ...(formula ? { formula: { ast: formula.ast, type: formula.type } } : {}),
      children: this.children(node.children, spec, childScope),
      loc: node.loc,
    };
  }

  // Whether a field tag's formula gives what the tag (and its field, for
  // overrides) can show. Reports it if not.
  private formulaResultFits(
    spec: TagSpec,
    formula: CompiledFormula,
    binding?: Binding,
    tag = spec.name,
  ) {
    const fail = (message: string) => {
      this.error("formula-result-type", message, formula.loc);
      return false;
    };
    if (isCollection(formula.type)) {
      return fail(
        `The formula gives ${describeType(formula.type)}; <${spec.name}> shows a single value (use sum, count, or join)`,
      );
    }
    const expected = formulaResults[tag];
    if (expected && !couldBe(formula.type, expected.kinds)) {
      return fail(`<${spec.name}>'s formula must give ${expected.wanted}, but it gives ${describeType(formula.type)}`);
    }
    if (binding?.field) {
      const stored = fieldType(binding.field);
      const kinds = typeMembers(stored).map((member) => member.kind);
      if (!kinds.includes("any") && !couldBe(formula.type, kinds as FormulaBaseKind[])) {
        return fail(
          `The formula gives ${describeType(formula.type)}, but "${binding.path.segments.join(".")}" holds ${describeType(stored)}`,
        );
      }
    }
    return true;
  }

  // Returns undefined if a required attribute is missing or unusable.
  private attributes(node: SheetElement, spec: TagSpec, scope: Shape) {
    const specs = new Map<string, [string, AttrSpec]>();
    for (const [name, attr] of Object.entries({ ...commonAttrsFor(spec), ...spec.attrs }))
      specs.set(name.toLowerCase(), [name, attr]);

    const attrs: Record<string, AttrValue> = {};
    for (const attr of node.attrs) {
      const entry = specs.get(attr.name.toLowerCase());
      if (!entry) {
        const noShow = noShowTags[spec.name];
        if (attr.name.toLowerCase() === "show" && noShow) {
          this.error("unknown-attribute", `<${spec.name}> has no show attribute; ${noShow}`, attr.loc);
          continue;
        }
        const known = Object.keys(spec.attrs);
        this.error(
          "unknown-attribute",
          `<${spec.name}> has no ${attr.name} attribute${known.length ? ` (it has: ${known.join(", ")})` : ""}`,
          attr.loc,
        );
        continue;
      }
      const [name, attrSpec] = entry;
      const value = this.attributeValue(spec, name, attrSpec, attr, scope);
      if (value !== undefined) attrs[name] = value;
    }

    let complete = true;
    for (const [name, attrSpec] of Object.entries(spec.attrs)) {
      if (!attrSpec.required || name in attrs) continue;
      if (!node.attrs.some((attr) => attr.name.toLowerCase() === name.toLowerCase())) {
        this.error("missing-attribute", `<${spec.name}> needs a ${name} attribute`, node.loc);
      }
      complete = false;
    }
    return complete ? attrs : undefined;
  }

  private attributeValue(
    spec: TagSpec,
    name: string,
    attrSpec: AttrSpec,
    attr: SheetAttr,
    scope: Shape,
  ): AttrValue | undefined {
    const { type } = attrSpec;
    const fail = (message: string, code = "invalid-attribute") => {
      this.error(code, message, attr.loc);
      return undefined;
    };

    if (attr.value === true) {
      return type.kind === "boolean"
        ? true
        : fail(`${name} on <${spec.name}> needs a value, like ${name}="…"`);
    }

    if (type.kind === "text") return this.compileParts(attr.value, scope);

    if (type.kind === "formula") {
      const raw = attr.raw ?? "";
      // A definition's body is checked with the other definitions.
      if (spec.category === "definition") return raw;
      if (!attr.valueLoc) return fail(`${name} on <${spec.name}> needs a value`);
      return this.compileFormula(raw, attr.valueLoc.start, scope, attr.valueLoc);
    }

    if (type.kind === "condition") {
      const raw = attr.raw ?? "";
      if (!raw.trim() || !attr.valueLoc) return fail(`${name} needs a formula, like ${name}="level >= 5"`);
      const compiled = this.compileFormula(raw, attr.valueLoc.start, scope, attr.valueLoc);
      if (!compiled) return undefined;
      if (!couldBe(compiled.type, ["boolean"])) {
        return fail(
          `${name} must give true or false, but ${raw.trim()} gives ${describeType(compiled.type)}`,
          "formula-result-type",
        );
      }
      return compiled;
    }

    if (type.kind === "number") {
      const [only] = attr.value;
      if (!type.dynamic && attr.value.some((part) => typeof part === "object")) {
        return fail(`${name} on <${spec.name}> must be a plain number, not {…}`);
      }
      if (attr.value.length === 1 && typeof only === "object") {
        const compiled = this.compileFormula(only.formula, only.bodyStart, scope, only.loc);
        if (!compiled) return undefined;
        if (!couldBe(compiled.type, ["number"])) {
          return fail(
            `${name} must be a number, but {${only.formula.trim()}} gives ${describeType(compiled.type)}`,
            "formula-result-type",
          );
        }
        return compiled;
      }
      const raw = plainText(attr.value)?.trim();
      const number = raw ? Number(raw) : Number.NaN;
      if (raw === undefined || !Number.isFinite(number))
        return fail(
          type.dynamic
            ? `${name} on <${spec.name}> must be a number or a single {formula}`
            : `${name} on <${spec.name}> must be a number`,
        );
      if (type.integer && !Number.isInteger(number))
        return fail(`${name} on <${spec.name}> must be a whole number`);
      if ((type.min !== undefined && number < type.min) || (type.max !== undefined && number > type.max)) {
        const range =
          type.max === undefined ? `at least ${type.min}` : `between ${type.min ?? "-∞"} and ${type.max}`;
        return fail(`${name} on <${spec.name}> must be ${range}`);
      }
      return number;
    }

    const raw = plainText(attr.value);
    if (raw === undefined)
      return fail(`${name} on <${spec.name}> can't use {…} field references`);

    switch (type.kind) {
      case "boolean":
        if (raw === "" || raw.toLowerCase() === "true") return true;
        if (raw.toLowerCase() === "false") return false;
        return fail(`${name} on <${spec.name}> must be true or false`);
      case "enum": {
        const value = type.values.find((item) => item.toLowerCase() === raw.trim().toLowerCase());
        return value ?? fail(`${name} on <${spec.name}> must be one of: ${type.values.join(", ")}`);
      }
      case "field": {
        const path = raw.trim();
        return isValidSheetPath(path) ? path : fail(invalidPathMessage(path));
      }
      case "list": {
        const items = raw.split(",").map((item) => item.trim()).filter(Boolean);
        return items.length ? items : fail(`${name} on <${spec.name}> needs at least one comma-separated value`);
      }
      case "name": {
        const value = raw.trim();
        if (!identifierPattern.test(value))
          return fail(`${name} on <${spec.name}> must be a name made of letters, numbers, and underscores, starting with a letter`);
        if (isReservedKey(value)) return fail(`"${value}" is reserved; choose another name`);
        return value;
      }
      case "icon": {
        const iconName = raw.trim();
        return iconPattern.test(iconName)
          ? iconName
          : fail(`${name} must be an icon name like i-lucide-sword`);
      }
      case "className": {
        const names = raw.split(/\s+/).filter(Boolean);
        const invalidName = names.find((item) => !classNamePattern.test(item));
        if (invalidName)
          return fail(`Class "${invalidName}" must use lowercase letters, numbers, and hyphens, starting with a letter`);
        return names;
      }
    }
  }
}

function publicDefinitions(definitions: Map<string, DefinitionState>) {
  return new Map<string, SheetDefinition>(
    [...definitions].map(([name, { params, type, ast, broken, loc }]) => [
      name,
      { name, params, type, ast: broken ? undefined : ast, broken, loc },
    ]),
  );
}

export function validateSheet(nodes: SheetNode[], schemas: SheetSchemas): ValidationResult {
  const validator = new Validator(schemas);
  const validated = validator.validate(nodes);
  return {
    nodes: validated,
    diagnostics: validator.diagnostics,
    definitions: publicDefinitions(validator.definitions),
    computedFields: validator.computedFields,
    stepBudget: sheetStepBudget(validator.formulaSites),
  };
}

// Parses and validates markup; diagnostics from both steps, in source order.
export function compileSheet(markup: string, schemas: SheetSchemas): ValidationResult {
  const parsed = parseSheetMarkup(markup);
  const validated = validateSheet(parsed.nodes, schemas);
  const diagnostics = [...parsed.diagnostics, ...validated.diagnostics].sort(
    (a, b) => a.loc.start.offset - b.loc.start.offset,
  );
  return { ...validated, diagnostics };
}

export function hasErrors(diagnostics: SheetDiagnostic[]) {
  return diagnostics.some((item) => item.severity === "error");
}

// Errors the markup has with the `after` schemas that it didn't have with
// `before` (compared by message, so they must be deterministic): what a
// schema change would break.
export function newSheetErrors(markup: string, before: SheetSchemas, after: SheetSchemas) {
  const errors = (schemas: SheetSchemas) =>
    compileSheet(markup, schemas).diagnostics.filter((item) => item.severity === "error");
  const known = new Set(errors(before).map((item) => item.message));
  return errors(after).filter((item) => !known.has(item.message));
}
