import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { uuidPattern } from "./resource-management";

// What a readable ID can be checked for: a resource kind, or a group.
export const AVAILABILITY_KINDS = [
  "system",
  "campaign",
  "contentType",
  "sheet",
  "content",
  "group",
] as const;
export type AvailabilityKind = (typeof AVAILABILITY_KINDS)[number];

const readableIdPattern = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

const availabilityQuerySchema = Type.Object({
  kind: Type.Union(AVAILABILITY_KINDS.map((kind) => Type.Literal(kind))),
  readableId: Type.String({ pattern: readableIdPattern, minLength: 1 }),
  // Resource kinds only: "me" or a group ID. Left out: the owner the resource
  // already has (with `resourceId`), else the caller.
  owner: Type.Optional(Type.String()),
  // The resource or group being edited: its own ID counts as available.
  resourceId: Type.Optional(Type.String({ pattern: uuidPattern.source })),
});

export interface AvailabilityQuery {
  kind: AvailabilityKind;
  readableId: string;
  // undefined: not given; null: the caller; string: a group ID.
  owner: string | null | undefined;
  resourceId: string | undefined;
}

// Validates the raw query. The readable ID is trimmed and lowercased first,
// like create and update requests (lookups are case-insensitive).
export function parseAvailabilityQuery(
  raw: Record<string, unknown>,
): { query: AvailabilityQuery } | { error: string } {
  const candidate: Record<string, unknown> = { ...raw };
  if (typeof candidate.readableId === "string")
    candidate.readableId = candidate.readableId.trim().toLowerCase();
  if (!Value.Check(availabilityQuerySchema, candidate)) {
    const first = [...Value.Errors(availabilityQuerySchema, candidate)][0];
    const field = first?.path.replace(/^\//, "") || "query";
    return {
      error:
        field === "readableId"
          ? "readableId must use lowercase letters, numbers, and hyphens"
          : `${field} is missing or invalid`,
    };
  }
  const { kind, readableId, owner, resourceId } = candidate as {
    kind: AvailabilityKind;
    readableId: string;
    owner?: string;
    resourceId?: string;
  };
  if (owner !== undefined && kind === "group")
    return { error: "owner does not apply to groups" };
  if (owner !== undefined && owner !== "me" && !uuidPattern.test(owner))
    return { error: "owner must be me or a group ID" };
  return {
    query: {
      kind,
      readableId,
      owner: owner === undefined ? undefined : owner === "me" ? null : owner,
      resourceId,
    },
  };
}
