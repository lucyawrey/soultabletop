// Schema-derived helpers for the Sheet editor: field paths for autocomplete
// and the reference panel, and sample data for the preview.

import {
  MAX_CONTENT_DEPTH,
  type ContentFieldSchema,
  type ContentTypeSchema,
} from "../content-schema";
import { humanizeFieldName } from "./registry";
import type { SheetSchemas } from "./validate";

export interface SheetFieldPath {
  path: string;
  type: string;
  label: string;
}

function typeName(field: ContentFieldSchema): string {
  if (field.type === "array") return `list of ${typeName(field.itemType)}`;
  return field.type;
}

// Every path a Sheet can bind at the top level: fields, fields of objects, and
// fields of referenced ContentTypes (up to MAX_CONTENT_DEPTH hops). Paths
// inside arrays are relative to their List item, so they're listed with a
// `[]` marker (e.g. "attacks[].name") to show where a List goes.
export function sheetFieldPaths(schemas: SheetSchemas): SheetFieldPath[] {
  const paths: SheetFieldPath[] = [{ path: "name", type: "string", label: "Name" }];
  const visit = (schema: ContentTypeSchema, prefix: string, depth: number) => {
    for (const [key, field] of Object.entries(schema)) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.push({
        path,
        type: typeName(field),
        label: field.label ?? humanizeFieldName(key),
      });
      visitField(field, path, depth);
    }
  };
  const visitField = (field: ContentFieldSchema, path: string, depth: number) => {
    if (field.type === "object") visit(field.entries, path, depth);
    else if (field.type === "array") visitField(field.itemType, `${path}[]`, depth);
    else if (field.type === "content" && depth < MAX_CONTENT_DEPTH) {
      const rules = schemas.types[field.contentTypeId];
      if (!rules) return;
      paths.push({ path: `${path}.name`, type: "string", label: "Name" });
      visit(rules.schema, path, depth + 1);
    }
  };
  visit(schemas.root.schema, "", 0);
  return paths;
}

// Plausible data for previewing a Sheet without real Content.
export function sampleSheetData(schemas: SheetSchemas): Record<string, unknown> {
  const sample = (field: ContentFieldSchema, key: string, depth: number): unknown => {
    const label = field.label ?? humanizeFieldName(key);
    switch (field.type) {
      case "string":
        return `Sample ${label.toLowerCase()}`;
      case "number":
        return 10;
      case "boolean":
        return true;
      case "any":
        return label;
      case "resourceRef":
        return undefined;
      case "array":
        return depth > 4
          ? []
          : [1, 2].map((index) => sample(field.itemType, `${key} ${index}`, depth + 1));
      case "object":
        return record(field.entries, depth + 1);
      case "content": {
        const rules = schemas.types[field.contentTypeId];
        return {
          name: `Sample ${label}`,
          ...(rules && depth < 4 ? record(rules.schema, depth + 1) : {}),
        };
      }
    }
  };
  const record = (schema: ContentTypeSchema, depth: number) =>
    Object.fromEntries(
      Object.entries(schema)
        .map(([key, field]) => [key, sample(field, key, depth)] as const)
        .filter(([, value]) => value !== undefined),
    );
  return { name: "Sample Name", ...record(schemas.root.schema, 0) };
}
