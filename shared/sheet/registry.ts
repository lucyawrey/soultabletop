// Every tag Sheet markup may use: its attributes, what it may contain, and
// which schema field types it can bind to. The validator enforces this; the
// renderer maps each tag to a component; the editor's reference panel and
// autocomplete are generated from it. See docs/sheet-system.md, section 2.

export type AttrType =
  // Free text; may contain {formula}s.
  | { kind: "text" }
  // A number; with `dynamic`, also a single {formula} computed
  // when rendering.
  | { kind: "number"; min?: number; max?: number; integer?: boolean; dynamic?: boolean }
  // Bare attribute, "true", or "false".
  | { kind: "boolean" }
  | { kind: "enum"; values: readonly string[] }
  // A field path, resolved against the schema.
  | { kind: "field" }
  // Comma-separated values.
  | { kind: "list" }
  // Iconify name, e.g. i-lucide-sword.
  | { kind: "icon" }
  // Space-separated CSS class names for the Sheet's own CSS.
  | { kind: "className" }
  // A formula, written as is (no braces): `formula="level + 2"`.
  | { kind: "formula" }
  // A bare formula that gives true, false, or nothing, like `level >= 5`.
  | { kind: "condition" }
  // An identifier, like a `<Define>`'s name.
  | { kind: "name" };

export interface AttrSpec {
  type: AttrType;
  required?: boolean;
  description: string;
}

// Schema field kinds a tag's `field` may point at. Paths the schema doesn't
// know about (non-strict types, inside free-form objects) are accepted by
// every field tag.
export type BindKind =
  | "string"
  | "number"
  | "boolean"
  | "scalar"
  | "object"
  | "resourceLink"
  | "content"
  | "array"
  | "stringArray"
  // An array of choice values (items with schema options).
  | "choiceArray"
  | "objectArray"
  // A struct whose entries are all alike (see `structRows`), and one whose
  // alike entries are structs.
  | "entries"
  | "objectEntries"
  | "anyValue";

export type ChildrenRule =
  | "any" // tags and text
  | "text" // text only (with {formula}s)
  | "none"
  | { only: readonly string[] };

export interface TagSpec {
  name: string;
  category: "layout" | "field" | "repeater" | "definition";
  description: string;
  attrs: Record<string, AttrSpec>;
  children: ChildrenRule;
  // Tags this one may appear directly inside (default: anywhere; [] means
  // top level only).
  parents?: readonly string[];
  // For tags with a `field` attribute: what it may bind to.
  binds?: readonly BindKind[];
  // Children are resolved against each item of the bound array.
  itemScope?: boolean;
  // The parent renders this tag itself, so live/locked/display on it would do
  // nothing: only `class` and `show` are common to it.
  noFlagAttrs?: boolean;
  // Takes no common attributes at all.
  noCommonAttrs?: boolean;
  // With `parents`: may also be at the top level.
  topLevel?: boolean;
  // Field tags that accept `formula`: `readOnly` shows the computed value
  // instead of a field; `override` may also have a field, which holds an
  // optional manual value that wins over the computed one.
  formula?: "readOnly" | "override";
}

export const colors = [
  "primary",
  "secondary",
  "success",
  "info",
  "warning",
  "error",
  "neutral",
] as const;
const gaps = ["none", "sm", "md", "lg"] as const;

const text = (description: string, required = false): AttrSpec => ({
  type: { kind: "text" },
  description,
  required,
});
const bool = (description: string): AttrSpec => ({
  type: { kind: "boolean" },
  description,
});
const oneOf = (values: readonly string[], description: string): AttrSpec => ({
  type: { kind: "enum", values },
  description,
});
const icon: AttrSpec = {
  type: { kind: "icon" },
  description: "Icon name, e.g. i-lucide-sword",
};

// How fields look when they can't be edited: plain text, or their input box,
// disabled. Also the values of the `sheet_display` Postgres enum.
export const SHEET_DISPLAYS = ["text", "box"] as const;
export type SheetDisplay = (typeof SHEET_DISPLAYS)[number];

// How tightly a sheet is laid out (`<Sheet density>`): roomy, the site's form
// spacing, or compact, smaller inputs and gaps for dense character sheets.
export const SHEET_DENSITIES = ["roomy", "compact"] as const;
export type SheetDensity = (typeof SHEET_DENSITIES)[number];

// Accepted by every tag.
export const commonAttrs: Record<string, AttrSpec> = {
  class: {
    type: { kind: "className" },
    description: "Class names your sheet CSS can target",
  },
  live: bool(
    "Fields inside stay editable with Edit off; live=\"false\" opts out",
  ),
  locked: bool(
    "Fields inside need their pencil button clicked before editing; locked=\"false\" opts out",
  ),
  display: oneOf(
    SHEET_DISPLAYS,
    "How fields inside look when they can't be edited: text, or box (their input, disabled); defaults to the sheet's setting",
  ),
  show: {
    type: { kind: "condition" },
    description:
      "Shows the tag only when this is true, like show=\"level >= 5\" or show=\"hasSpells\"; false or empty hides it",
  },
};

// Tags that take no `show` (with the reason, for the error message).
export const noShowTags: Readonly<Record<string, string>> = {
  Column: "use show on the Table, or a formula in the column",
};

// The common attributes a tag accepts.
export function commonAttrsFor(spec: TagSpec): Record<string, AttrSpec> {
  if (spec.noCommonAttrs) return {};
  const { class: className, show, ...flags } = commonAttrs;
  const visible: Record<string, AttrSpec> = spec.name in noShowTags ? {} : { show: show! };
  if (spec.noFlagAttrs) return { class: className!, ...visible };
  return { class: className!, ...flags, ...visible };
}

const fieldAttrs: Record<string, AttrSpec> = {
  field: {
    type: { kind: "field" },
    description: "Path of the field this shows, e.g. stats.strength",
  },
  label: text(
    "Label; defaults to the schema label, then the field name",
  ),
  hideLabel: bool(
    "Doesn't show the label (a Column's header is left empty); it still names the input for screen readers",
  ),
  hint: text("Help text; defaults to the schema description"),
};

// `formula` on field tags; see TagSpec.formula.
const readOnlyFormula: AttrSpec = {
  type: { kind: "formula" },
  description: "Computes the value instead of reading a field, like formula=\"level * 2\"",
};
const overrideFormula: AttrSpec = {
  type: { kind: "formula" },
  description:
    "Computes the value; with field, the field holds an optional manual value that wins, and clearing it goes back to the computed one",
};

const formatAttr = oneOf(
  ["plain", "signed"],
  "signed shows +2 for positive numbers (an editable input shows the sign too; the saved value stays a number)",
);

const tagList: TagSpec[] = [
  // Layout
  {
    name: "Sheet",
    category: "layout",
    description: "Optional root wrapping the whole sheet",
    attrs: {
      density: oneOf(
        SHEET_DENSITIES,
        "roomy (the default) uses the site's form spacing; compact uses smaller inputs, labels, and gaps",
      ),
    },
    children: "any",
    parents: [],
  },
  {
    name: "Section",
    category: "layout",
    description: "A card with an optional title",
    attrs: {
      title: text("Heading of the card"),
      description: text("Text under the title"),
      icon,
      span: {
        type: { kind: "number", min: 1, max: 12, integer: true },
        description: "Columns to span inside a Grid",
      },
      collapsible: bool("Can be collapsed by clicking the title"),
      collapsed: bool("Starts collapsed (implies collapsible)"),
    },
    children: "any",
  },
  {
    name: "Grid",
    category: "layout",
    description: "Columns of equal width; one column on phones",
    attrs: {
      cols: {
        type: { kind: "number", min: 1, max: 12, integer: true },
        description: "Number of columns (default 2)",
      },
      gap: oneOf(gaps, "Space between items (default md)"),
    },
    children: "any",
  },
  {
    name: "Stack",
    category: "layout",
    description: "Items in a row or a column",
    attrs: {
      direction: oneOf(["row", "column"], "Row or column (default column)"),
      gap: oneOf(gaps, "Space between items (default md)"),
      align: oneOf(
        ["start", "center", "end", "stretch"],
        "Cross-axis alignment",
      ),
      wrap: bool("Wrap onto more lines when out of room"),
    },
    children: "any",
  },
  {
    name: "Tabs",
    category: "layout",
    description: "Tabbed panels; contains only Tab tags",
    attrs: {},
    children: { only: ["Tab"] },
  },
  {
    name: "Tab",
    category: "layout",
    description: "One panel of Tabs",
    attrs: { label: text("Tab title", true), icon },
    children: "any",
    parents: ["Tabs"],
    noFlagAttrs: true,
  },
  {
    name: "Divider",
    category: "layout",
    description: "A horizontal line with an optional label",
    attrs: { label: text("Text in the middle of the line") },
    children: "none",
  },
  {
    name: "Heading",
    category: "layout",
    description: "A heading",
    attrs: {
      level: {
        type: { kind: "number", min: 1, max: 4, integer: true },
        description: "1 (largest) to 4 (default 1)",
      },
    },
    children: "text",
  },
  {
    name: "Note",
    category: "layout",
    description: "Muted text",
    attrs: {},
    children: "text",
  },
  {
    name: "Callout",
    category: "layout",
    description: "A highlighted box",
    attrs: {
      color: oneOf(colors, "Color (default info)"),
      icon,
      title: text("Bold first line"),
    },
    children: "text",
  },
  {
    name: "Badge",
    category: "layout",
    description: "A small label",
    attrs: { color: oneOf(colors, "Color (default primary)") },
    children: "text",
  },
  {
    name: "Collapsible",
    category: "layout",
    description: "A header that shows or hides its content when clicked",
    attrs: {
      title: text("Header text", true),
      subtitle: text("Smaller text after the title"),
      icon,
      open: bool("Starts expanded"),
    },
    children: "any",
  },

  // Fields
  {
    name: "Field",
    category: "field",
    description: "Picks the input from the field's schema type",
    attrs: {
      ...fieldAttrs,
      formula: {
        type: { kind: "formula" },
        description:
          "On a text, number, or true/false field only: computes the value like Text, Number, or Checkbox with a formula (needs field)",
      },
    },
    children: "none",
    binds: [
      "string",
      "number",
      "boolean",
      "scalar",
      "object",
      "resourceLink",
      "content",
      "stringArray",
      "choiceArray",
    ],
    formula: "override",
  },
  {
    name: "Text",
    category: "field",
    description: "A text field",
    attrs: {
      ...fieldAttrs,
      formula: overrideFormula,
      multiline: bool("Several lines"),
      placeholder: text("Shown when empty while editing"),
    },
    children: "none",
    binds: ["string"],
    formula: "override",
  },
  {
    name: "Number",
    category: "field",
    description: "A number field",
    attrs: {
      ...fieldAttrs,
      formula: overrideFormula,
      min: { type: { kind: "number", dynamic: true }, description: "Smallest value" },
      max: { type: { kind: "number", dynamic: true }, description: "Largest value" },
      step: { type: { kind: "number", dynamic: true }, description: "Increment" },
      format: formatAttr,
      variant: oneOf(
        ["input", "stat"],
        "stat shows a large number with a small label",
      ),
    },
    children: "none",
    binds: ["number"],
    formula: "override",
  },
  {
    name: "Checkbox",
    category: "field",
    description: "A checkbox",
    attrs: {
      ...fieldAttrs,
      formula: overrideFormula,
      style: oneOf(
        ["check", "dot"],
        "check (default) or dot: a filled or empty circle, with no Yes/No text",
      ),
    },
    children: "none",
    binds: ["boolean"],
    formula: "override",
  },
  {
    name: "Toggle",
    category: "field",
    description: "An on/off switch",
    attrs: { ...fieldAttrs },
    children: "none",
    binds: ["boolean"],
  },
  {
    name: "Select",
    category: "field",
    description: "A choice from a list: the field's options, or its own list",
    attrs: {
      ...fieldAttrs,
      options: {
        type: { kind: "list" },
        description: "Comma-separated choices, for a text field without options in the schema",
      },
    },
    children: "none",
    binds: ["string", "number"],
  },
  {
    name: "Tags",
    category: "field",
    description: "A list of short texts",
    attrs: { ...fieldAttrs },
    children: "none",
    binds: ["stringArray"],
  },
  {
    name: "Tracker",
    category: "field",
    description: "A current value out of a maximum, as a bar or boxes",
    attrs: {
      ...fieldAttrs,
      formula: readOnlyFormula,
      max: {
        type: { kind: "number", min: 0, dynamic: true },
        description:
          "Maximum: a number or a {formula}; without one (or at 0), only the value shows",
      },
      style: oneOf(["bar", "pips"], "bar (default) or tick boxes"),
    },
    children: "none",
    binds: ["number"],
    formula: "readOnly",
  },
  {
    name: "Ref",
    category: "field",
    description: "A link to another resource or content",
    attrs: { ...fieldAttrs },
    children: "none",
    binds: ["resourceLink", "content"],
  },
  {
    name: "Value",
    category: "field",
    description: "Shows a value; never editable",
    attrs: {
      ...fieldAttrs,
      formula: readOnlyFormula,
      format: formatAttr,
    },
    children: "none",
    binds: ["anyValue"],
    formula: "readOnly",
  },
  {
    name: "Markdown",
    category: "field",
    description: "Formatted long text",
    attrs: { ...fieldAttrs },
    children: "none",
    binds: ["string"],
  },
  {
    name: "Image",
    category: "field",
    description: "An image from an https URL",
    attrs: {
      ...fieldAttrs,
      alt: text("Description for screen readers"),
      size: oneOf(["sm", "md", "lg", "full"], "Size (default md)"),
    },
    children: "none",
    binds: ["string"],
  },

  // Repeaters
  {
    name: "List",
    category: "repeater",
    description:
      "Repeats its content for each item of an array, or each entry of a struct; paths inside are relative to the item",
    attrs: {
      field: { ...fieldAttrs.field!, required: true },
      label: fieldAttrs.label!,
      layout: oneOf(["stack", "grid"], "stack (default) or grid"),
      cols: {
        type: { kind: "number", min: 1, max: 12, integer: true },
        description: "Columns for layout=\"grid\"",
      },
      addLabel: text("Text of the add button (default \"Add\")"),
    },
    children: "any",
    binds: ["array", "entries"],
    itemScope: true,
  },
  {
    name: "Table",
    category: "repeater",
    description: "An array of objects, or a struct of structs, as a table; contains Column tags",
    attrs: { field: { ...fieldAttrs.field!, required: true }, label: fieldAttrs.label! },
    children: { only: ["Column", "RowDetails"] },
    binds: ["objectArray", "objectEntries"],
    itemScope: true,
  },
  {
    name: "Column",
    category: "field",
    description: "One column of a Table",
    attrs: {
      ...fieldAttrs,
      formula: readOnlyFormula,
      format: formatAttr,
      width: oneOf(["auto", "xs", "sm", "md", "lg"], "Column width"),
    },
    children: "none",
    parents: ["Table"],
    binds: ["string", "number", "boolean", "scalar", "resourceLink", "content"],
    formula: "readOnly",
  },
  {
    name: "RowDetails",
    category: "layout",
    description: "Content shown when a Table row is expanded",
    attrs: {},
    children: "any",
    parents: ["Table"],
    noFlagAttrs: true,
  },

  // Definitions
  {
    name: "Define",
    category: "definition",
    description:
      "A reusable formula: called as name() or name(a, b) in any formula of the sheet; shows nothing",
    attrs: {
      name: { type: { kind: "name" }, required: true, description: "The name to call it by" },
      params: {
        type: { kind: "list" },
        description: "Comma-separated parameter names (at most 8), like params=\"attr, rank\"",
      },
      formula: {
        type: { kind: "formula" },
        required: true,
        description: "The formula; parameters are used by name, and /name reaches a field with the same name",
      },
    },
    children: "none",
    parents: ["Sheet"],
    topLevel: true,
    noCommonAttrs: true,
  },
];

export const sheetTags: ReadonlyMap<string, TagSpec> = new Map(
  tagList.map((spec) => [spec.name.toLowerCase(), spec]),
);

export function findTag(name: string) {
  return sheetTags.get(name.toLowerCase());
}

// "hitPoints" / "hit_points" -> "Hit Points"
export function humanizeFieldName(key: string) {
  return key
    .replace(/_+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
