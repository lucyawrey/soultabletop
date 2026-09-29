// Checks parsed Sheet markup against the tag registry and the ContentType
// schema, and turns it into the tree the renderer consumes. Broken tags become
// `invalid` nodes (shown as placeholders to Sheet editors) so the rest of the
// Sheet still renders. See docs/sheet-system.md, section 3.

import {
  MAX_CONTENT_DEPTH,
  NAME_FIELD,
  type ContentFieldSchema,
  type ContentTypeRules,
  type ContentTypeSchema,
} from "../content-schema";
import {
  isValidSheetPath,
  parseSheetMarkup,
  type Interpolation,
  type Loc,
  type SheetAttr,
  type SheetDiagnostic,
  type SheetElement,
  type SheetNode,
  type TextPart,
} from "./parser";
import {
  commonAttrs,
  findTag,
  humanizeFieldName,
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

export interface SheetPath {
  // Starts at the top level (`/name`) instead of the current List item.
  absolute: boolean;
  // Empty for `.`, the current item itself.
  segments: string[];
}

export function parseSheetPath(path: string): SheetPath {
  const absolute = path.startsWith("/");
  const rest = absolute ? path.slice(1) : path;
  return { absolute, segments: rest === "." ? [] : rest.split(".") };
}

export interface Binding {
  path: SheetPath;
  // The schema field, when the schema knows it (not for `any` or unknown paths).
  field?: ContentFieldSchema;
  label: string;
  description?: string;
}

export type AttrValue =
  | boolean
  | number
  | string
  | string[]
  | TextPart[] // text attributes
  | Interpolation; // number attributes given as {path}

export interface ValidatedElement {
  type: "element";
  tag: string; // canonical name, e.g. "Section"
  spec: TagSpec;
  attrs: Record<string, AttrValue>;
  binding?: Binding;
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

export interface ValidationResult {
  nodes: ValidatedNode[];
  diagnostics: SheetDiagnostic[];
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

function describeField(field: ContentFieldSchema) {
  switch (field.type) {
    case "string":
      return "a text field";
    case "number":
      return "a number field";
    case "boolean":
      return "a yes/no field";
    case "array":
      return "a list";
    case "object":
      return "a group of fields";
    case "resourceRef":
      return "a resource link";
    case "content":
      return "a content field";
    default:
      return "a field";
  }
}

function describeShape(shape: Shape) {
  if (shape.kind === "record") return "a group of fields";
  if (shape.kind === "field") return describeField(shape.field);
  return "an unknown field";
}

// Plain attribute text, or undefined if it contains {path} interpolation.
function plainText(parts: TextPart[]) {
  if (parts.some((part) => typeof part !== "string")) return undefined;
  return parts.join("");
}

class Validator {
  readonly diagnostics: SheetDiagnostic[] = [];
  private readonly rootShape: Shape;

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
    return this.children(nodes, null, this.rootShape);
  }

  private error(code: string, message: string, loc: Loc) {
    this.diagnostics.push({ severity: "error", code, message, loc });
  }

  private warn(code: string, message: string, loc: Loc) {
    this.diagnostics.push({ severity: "warning", code, message, loc });
  }

  // Paths

  // Turns an `object` or `content` field into the record of its fields.
  private enter(shape: Shape, path: string, loc: Loc): Shape | undefined {
    if (shape.kind !== "field") return shape;
    const { field } = shape;
    if (field.type === "object") {
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
      this.warn(
        "unknown-field",
        `"${path}": ${where} has no field "${segment}"; it will show whatever the data holds`,
        loc,
      );
      return { kind: "unknown", depth: shape.depth };
    }

    const { field } = shape;
    if (field.type === "any") return { kind: "unknown", depth: shape.depth };
    if (field.type === "array") {
      if (indexPattern.test(segment)) {
        return { kind: "field", field: field.itemType, strict: shape.strict, depth: shape.depth };
      }
      this.error(
        "not-an-object",
        `"${path}": "${walked}" is a list; use an index like ${walked}.0, or a <List>`,
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

  private resolve(path: string, scope: Shape, loc: Loc): Shape | undefined {
    const parsed = parseSheetPath(path);
    let shape: Shape | undefined = parsed.absolute ? this.rootShape : scope;
    const walked: string[] = [];
    for (const segment of parsed.segments) {
      shape = this.step(shape, segment, walked.join("."), path, loc);
      if (!shape) return undefined;
      walked.push(segment);
    }
    return shape;
  }

  private bindKinds(shape: Shape): Set<BindKind> | "all" {
    if (shape.kind === "unknown") return "all";
    const kinds = new Set<BindKind>(["anyValue"]);
    if (shape.kind === "record") return kinds;
    const { field } = shape;
    switch (field.type) {
      case "any":
        return "all";
      case "string":
      case "number":
      case "boolean":
      case "resourceRef":
      case "content":
        kinds.add(field.type);
        break;
      case "array": {
        kinds.add("array");
        const item = field.itemType.type;
        if (item === "string" || item === "any") kinds.add("stringArray");
        if (item === "object" || item === "content" || item === "any")
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

  private checkInterpolations(parts: TextPart[], scope: Shape) {
    for (const part of parts) {
      if (typeof part === "string") continue;
      const shape = this.resolve(part.path, scope, part.loc);
      if (
        shape?.kind === "record" ||
        (shape?.kind === "field" && shape.field.type === "object")
      ) {
        this.warn(
          "interpolates-object",
          `{${part.path}} is a group of fields and will show as raw data`,
          part.loc,
        );
      }
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
        this.checkInterpolations(node.parts, scope);
        result.push({ type: "text", parts: node.parts, loc: node.loc });
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
      if (spec.parents.length && (!parent || !spec.parents.includes(parent.name))) {
        const allowed = spec.parents.map((name) => `<${name}>`).join(" or ");
        return invalid("misplaced-tag", `<${spec.name}> must be directly inside ${allowed}`);
      }
    }

    const attrs = this.attributes(node, spec, scope);
    if (!attrs) {
      return { type: "invalid", tag: node.tag, message: `<${spec.name}> has errors`, loc: node.loc };
    }

    let binding: Binding | undefined;
    let childScope = scope;
    if (typeof attrs.field === "string") {
      const path = attrs.field;
      const shape = this.resolve(path, scope, node.loc);
      if (!shape) {
        return { type: "invalid", tag: node.tag, message: `Can't find field "${path}"`, loc: node.loc };
      }
      const kinds = this.bindKinds(shape);
      if (kinds !== "all" && !spec.binds?.some((kind) => kinds.has(kind))) {
        const suggestion =
          kinds.has("array") ? "; use <List> or <Table>" :
          shape.kind === "record" || (shape.kind === "field" && shape.field.type === "object")
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
        field: field?.type === "any" ? undefined : field,
        label:
          field?.label ??
          (lastSegment && !indexPattern.test(lastSegment)
            ? humanizeFieldName(lastSegment)
            : ""),
        description: field?.description,
      };
      if (spec.itemScope) childScope = this.itemShape(shape);
    }

    return {
      type: "element",
      tag: spec.name,
      spec,
      attrs,
      binding,
      children: this.children(node.children, spec, childScope),
      loc: node.loc,
    };
  }

  // Returns undefined if a required attribute is missing or unusable.
  private attributes(node: SheetElement, spec: TagSpec, scope: Shape) {
    const specs = new Map<string, [string, AttrSpec]>();
    for (const [name, attr] of Object.entries({ ...commonAttrs, ...spec.attrs }))
      specs.set(name.toLowerCase(), [name, attr]);

    const attrs: Record<string, AttrValue> = {};
    for (const attr of node.attrs) {
      const entry = specs.get(attr.name.toLowerCase());
      if (!entry) {
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
    const fail = (message: string) => {
      this.error("invalid-attribute", message, attr.loc);
      return undefined;
    };

    if (attr.value === true) {
      return type.kind === "boolean"
        ? true
        : fail(`${name} on <${spec.name}> needs a value, like ${name}="…"`);
    }

    if (type.kind === "text") {
      this.checkInterpolations(attr.value, scope);
      return attr.value;
    }

    if (type.kind === "number") {
      const [only] = attr.value;
      if (attr.value.length === 1 && typeof only === "object") {
        const shape = this.resolve(only.path, scope, only.loc);
        if (shape?.kind === "field" && shape.field.type !== "number" && shape.field.type !== "any")
          return fail(`${name}="{${only.path}}" must point at a number field, but it's ${describeField(shape.field)}`);
        return shape ? only : undefined;
      }
      const raw = plainText(attr.value)?.trim();
      const number = raw ? Number(raw) : Number.NaN;
      if (raw === undefined || !Number.isFinite(number))
        return fail(`${name} on <${spec.name}> must be a number or a single {field}`);
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
        return isValidSheetPath(path)
          ? path
          : fail(`"${path}" isn't a valid field path; use names joined by dots, like stats.strength`);
      }
      case "list": {
        const items = raw.split(",").map((item) => item.trim()).filter(Boolean);
        return items.length ? items : fail(`${name} on <${spec.name}> needs at least one comma-separated value`);
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

export function validateSheet(nodes: SheetNode[], schemas: SheetSchemas): ValidationResult {
  const validator = new Validator(schemas);
  const validated = validator.validate(nodes);
  return { nodes: validated, diagnostics: validator.diagnostics };
}

// Parses and validates markup; diagnostics from both steps, in source order.
export function compileSheet(markup: string, schemas: SheetSchemas): ValidationResult {
  const parsed = parseSheetMarkup(markup);
  const validated = validateSheet(parsed.nodes, schemas);
  const diagnostics = [...parsed.diagnostics, ...validated.diagnostics].sort(
    (a, b) => a.loc.start.offset - b.loc.start.offset,
  );
  return { nodes: validated.nodes, diagnostics };
}

export function hasErrors(diagnostics: SheetDiagnostic[]) {
  return diagnostics.some((item) => item.severity === "error");
}
