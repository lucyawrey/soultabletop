// Builds Sheet markup from a ContentType schema. Used when Content has no
// readable Sheet, and as a starting point for new Sheets ("Copy to new
// Sheet"). The output is ordinary markup, so it goes through the same
// validation and rendering as hand-written Sheets. See docs/sheet-system.md,
// section 4.

import type {
  ContentFieldSchema,
  ContentTypeSchema,
} from "../content-schema";
import { humanizeFieldName } from "./registry";
import type { SheetSchemas } from "./validate";

export const GENERATED_SHEET_NAME = "Generated (from schema)";

export type ContentCategory =
  | "general"
  | "nonPlayerCharacter"
  | "document"
  | "playerCharacter";

// Initial Edit/Autosave switch state for generated sheets.
export function generatedSheetDefaults(category: ContentCategory) {
  switch (category) {
    case "playerCharacter":
      return { defaultEditMode: true, defaultAutosave: true };
    case "nonPlayerCharacter":
      return { defaultEditMode: false, defaultAutosave: true };
    default:
      return { defaultEditMode: false, defaultAutosave: false };
  }
}

// Escapes text for a double-quoted attribute value.
export function escapeSheetAttribute(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/[{}]/g, (char) => `\\${char}`)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

// Fields shown with a plain <Field> in a two-column grid.
function isSimple(field: ContentFieldSchema) {
  switch (field.type) {
    case "string":
    case "number":
    case "boolean":
    case "any":
    case "resourceRef":
      return true;
    case "array":
      return field.itemType.type === "string";
    default:
      return false;
  }
}

// Fields a Table <Column> can show.
function isColumnable(field: ContentFieldSchema) {
  return ["string", "number", "boolean", "any", "resourceRef", "content"].includes(
    field.type,
  );
}

function label(key: string, field: ContentFieldSchema) {
  return escapeSheetAttribute(field.label ?? humanizeFieldName(key));
}

function join(prefix: string, key: string) {
  return prefix ? `${prefix}.${key}` : key;
}

export function generateSheetMarkup(schemas: SheetSchemas): string {
  const lines: string[] = [];
  const add = (depth: number, text: string) =>
    lines.push(`${"  ".repeat(depth)}${text}`);

  // A grid of the simple fields, then a Section per complex field.
  function fields(
    schema: ContentTypeSchema,
    prefix: string,
    depth: number,
    withName: boolean,
  ) {
    const entries = Object.entries(schema);
    const simple = entries.filter(([, field]) => isSimple(field));
    if (withName || simple.length) {
      add(depth, "<Grid cols=\"2\">");
      if (withName) add(depth + 1, `<Text field="${join(prefix, "name")}" />`);
      for (const [key] of simple)
        add(depth + 1, `<Field field="${join(prefix, key)}" />`);
      add(depth, "</Grid>");
    }
    for (const [key, field] of entries) {
      if (!isSimple(field)) complex(key, field, join(prefix, key), depth);
    }
  }

  // The simple fields of a referenced ContentType, one level deep.
  function referencedFields(contentTypeId: string, prefix: string, depth: number) {
    const rules = schemas.types[contentTypeId];
    const simple = Object.entries(rules?.schema ?? {}).filter(([, field]) =>
      isSimple(field),
    );
    if (!simple.length) return;
    add(depth, "<Grid cols=\"2\">");
    for (const [key] of simple)
      add(depth + 1, `<Field field="${join(prefix, key)}" />`);
    add(depth, "</Grid>");
  }

  function complex(
    key: string,
    field: ContentFieldSchema,
    path: string,
    depth: number,
  ) {
    add(depth, `<Section title="${label(key, field)}">`);
    const inner = depth + 1;
    if (field.type === "object") {
      fields(field.entries, path, inner, false);
    } else if (field.type === "content") {
      add(inner, `<Ref field="${path}" />`);
      referencedFields(field.contentTypeId, path, inner);
    } else if (field.type === "array") {
      const item = field.itemType;
      if (item.type === "object" && Object.values(item.entries).every(isColumnable)) {
        add(inner, `<Table field="${path}">`);
        for (const [entryKey] of Object.entries(item.entries))
          add(inner + 1, `<Column field="${entryKey}" />`);
        add(inner, "</Table>");
      } else if (item.type === "object") {
        add(inner, `<List field="${path}">`);
        fields(item.entries, "", inner + 1, false);
        add(inner, "</List>");
      } else if (item.type === "content") {
        add(inner, `<List field="${path}">`);
        add(inner + 1, "<Collapsible title=\"{name}\">");
        add(inner + 2, "<Ref field=\".\" />");
        referencedFields(item.contentTypeId, "", inner + 2);
        add(inner + 1, "</Collapsible>");
        add(inner, "</List>");
      } else if (item.type === "array") {
        add(inner, `<Value field="${path}" />`);
      } else {
        add(inner, `<List field="${path}">`);
        add(inner + 1, "<Field field=\".\" />");
        add(inner, "</List>");
      }
    } else {
      add(inner, `<Value field="${path}" />`);
    }
    add(depth, "</Section>");
  }

  add(0, "<Section title=\"Details\">");
  const root = schemas.root.schema;
  const simpleRoot = Object.fromEntries(
    Object.entries(root).filter(([, field]) => isSimple(field)),
  );
  fields(simpleRoot, "", 1, true);
  add(0, "</Section>");
  for (const [key, field] of Object.entries(root)) {
    if (!isSimple(field)) complex(key, field, key, 0);
  }
  return `${lines.join("\n")}\n`;
}
