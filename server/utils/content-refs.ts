import { eq, inArray } from "drizzle-orm";
import type { User } from "better-auth";
import { content, resource } from "../database/schema";
import {
  MAX_CONTENT_DEPTH,
  MAX_CONTENT_REFS,
  type ContentFieldSchema,
  type ContentTypeSchema,
} from "../../shared/content-schema";
import type { SheetSchemas } from "../../shared/sheet/validate";
import { useDatabase } from "./database";
import { getResourceAccess, loadResourceAccessContext } from "./resource-access";
import { uuidPattern } from "./resource-management";

export interface ContentRef {
  name: string;
  contentTypeId: string;
  data: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Collects referenced Content IDs from `value` following `schema`, with the
// number of `content` fields crossed to reach each.
function collectRefs(
  value: unknown,
  schema: ContentTypeSchema,
  schemas: SheetSchemas,
  depth: number,
  found: Map<string, number>,
) {
  if (!isRecord(value)) return;
  const visit = (item: unknown, field: ContentFieldSchema, itemDepth: number) => {
    if (field.type === "array") {
      if (Array.isArray(item))
        for (const entry of item) visit(entry, field.itemType, itemDepth);
    } else if (field.type === "object") {
      collectRefs(item, field.entries, schemas, itemDepth, found);
    } else if (field.type === "content") {
      const next = itemDepth + 1;
      if (next > MAX_CONTENT_DEPTH) return;
      if (typeof item === "string" && uuidPattern.test(item)) {
        if (!found.has(item) || found.get(item)! > next) found.set(item, next);
      } else if (isRecord(item)) {
        // Local data can itself reference other Content.
        const rules = schemas.types[field.contentTypeId];
        if (rules) collectRefs(item, rules.schema, schemas, next, found);
      }
    }
  };
  for (const [key, field] of Object.entries(schema)) {
    if (key in value) visit(value[key], field, depth);
  }
}

// Loads the Content referenced from `data` (directly, through local data, or
// through other referenced Content, up to MAX_CONTENT_DEPTH hops) that `user`
// can read. Unreadable and missing references are left out.
export async function loadContentRefs(
  user: Pick<User, "id" | "name">,
  data: Record<string, unknown>,
  schemas: SheetSchemas,
): Promise<Record<string, ContentRef>> {
  const refs: Record<string, ContentRef> = {};
  const visited = new Set<string>();
  let pending = new Map<string, number>();
  collectRefs(data, schemas.root.schema, schemas, 0, pending);

  while (pending.size && visited.size < MAX_CONTENT_REFS) {
    const ids = [...pending.keys()]
      .filter((id) => !visited.has(id))
      .slice(0, MAX_CONTENT_REFS - visited.size);
    if (!ids.length) break;
    ids.forEach((id) => visited.add(id));

    const rows = await useDatabase()
      .select({ resource, item: content })
      .from(content)
      .innerJoin(resource, eq(resource.id, content.resourceId))
      .where(inArray(content.resourceId, ids));
    const context = await loadResourceAccessContext(user, ids);
    const next = new Map<string, number>();
    for (const row of rows) {
      if (!getResourceAccess(row.resource, context).canRead) continue;
      refs[row.resource.id] = {
        name: row.resource.name,
        contentTypeId: row.item.contentTypeId,
        data: row.item.data,
      };
      const rules = schemas.types[row.item.contentTypeId];
      if (rules)
        collectRefs(row.item.data, rules.schema, schemas, pending.get(row.resource.id)!, next);
    }
    pending = next;
  }
  return refs;
}
