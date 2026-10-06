import { describe, expect, it } from "vitest";
import { generatedCard, sheetPreviewTarget } from "./card";
import type { SheetRefs, SheetScope } from "./runtime";
import type { SheetSchemas, ValidatedElement, ValidatedNode } from "./validate";
import { compileInSheet as compileSheet } from "./fixtures/in-sheet";

// Reference previews: `preview` on Ref, Value, and Column, and `<Card>`.

const schemas: SheetSchemas = {
  root: {
    hasStrictSchema: true,
    showSheetWarnings: true,
    schema: {
      level: { type: "number" },
      deity: { type: "content", contentTypeId: "deity", allow: "reference" },
      link: { type: "resourceLink" },
      spells: {
        type: "array",
        itemType: { type: "content", contentTypeId: "spell", allow: "both" },
      },
      inventory: {
        type: "array",
        itemType: {
          type: "struct",
          entries: {
            item: { type: "content", contentTypeId: "item", allow: "reference" },
            qty: { type: "number" },
          },
        },
      },
    },
  },
  types: {
    deity: { hasStrictSchema: true, schema: { domains: { type: "array", itemType: { type: "string" } } } },
    spell: {
      hasStrictSchema: true,
      schema: {
        rank: { type: "number" },
        traits: { type: "array", itemType: { type: "string" } },
        description: { type: "string" },
      },
    },
    item: {
      hasStrictSchema: true,
      schema: {
        bulk: { type: "number" },
        material: { type: "content", contentTypeId: "deity", allow: "reference" },
      },
    },
  },
};

const messages = (markup: string) =>
  compileSheet(markup, schemas).diagnostics.map((item) => `${item.severity} ${item.code}: ${item.message}`);

function tag(markup: string, name: string): ValidatedElement {
  const compiled = compileSheet(markup, schemas);
  expect(compiled.diagnostics).toEqual([]);
  const visit = (nodes: ValidatedNode[]): ValidatedElement | undefined => {
    for (const node of nodes) {
      if (node.type !== "element") continue;
      if (node.tag === name) return node;
      const found = visit(node.children);
      if (found) return found;
    }
    return undefined;
  };
  return visit(compiled.nodes)!;
}

describe("preview validation", () => {
  it("previews the content field a path goes through", () => {
    expect(tag(`<Ref field="deity" preview />`, "Ref").preview).toEqual({
      path: { absolute: false, segments: ["deity"] },
      contentTypeId: "deity",
    });
    expect(tag(`<Value field="deity.name" preview />`, "Value").preview).toEqual({
      path: { absolute: false, segments: ["deity"] },
      contentTypeId: "deity",
    });
    // The last content field on the way: the item, not its material.
    expect(
      tag(`<Table field="inventory"><Column field="item.bulk" preview /></Table>`, "Column").preview,
    ).toEqual({ path: { absolute: false, segments: ["item"] }, contentTypeId: "item" });
    // A row that is content previews the row itself.
    expect(
      tag(`<Table field="spells"><Column field="name" preview /></Table>`, "Column").preview,
    ).toEqual({ path: { absolute: false, segments: [] }, contentTypeId: "spell" });
  });

  it("needs a content field on the way", () => {
    expect(messages(`<Value field="level" preview />`)).toEqual([
      "error invalid-attribute: preview needs a field reached through a content field, like spell.name",
    ]);
    expect(messages(`<Value formula="level" preview />`)).toEqual([
      "error invalid-attribute: preview needs a field: <Value> previews the content its field is reached through",
    ]);
    expect(messages(`<Ref field="link" preview />`)).toEqual([
      "error invalid-attribute: preview on <Ref> needs a content field (a resource link has no card)",
    ]);
  });

  it("checks a Card against the referenced content", () => {
    const ref = tag(
      `<Table field="spells"><Column field="name" preview><Card><Value field="rank" /><Tags field="traits" /><Value field="/level" /></Card></Column></Table>`,
      "Column",
    );
    expect(ref.children.map((child) => child.type === "element" && child.tag)).toEqual(["Card"]);
    expect(messages(`<Ref field="deity" preview><Card><Value field="rank" /></Card></Ref>`)).toEqual([
      'error unknown-field: "rank": the schema has no field "rank"',
    ]);
  });

  it("keeps cards read-only and single", () => {
    expect(messages(`<Ref field="deity"><Card /></Ref>`)).toEqual([
      "error card-without-preview: <Card> is shown by a preview; add preview to its <Ref>",
    ]);
    expect(messages(`<Ref field="deity" preview><Card /><Card /></Ref>`)).toEqual([
      "error duplicate-card: <Ref> has only one <Card>",
    ]);
    expect(
      messages(`<Table field="inventory"><Column field="item.name" preview><Card><Ref field="material" preview /></Card></Column></Table>`),
    ).toEqual(["error preview-in-card: A card can't open another card; remove preview"]);
    expect(
      messages(`<Ref field="deity" preview><Card><Button label="Go"><Set field="/level" formula="1" /></Button></Card></Ref>`),
    ).toEqual(["error button-in-card: <Button> can't be in a <Card>: cards are read-only"]);
    expect(messages(`<Card />`)).toEqual([
      "error misplaced-tag: <Card> must be directly inside <Ref> or <Value> or <Column>",
    ]);
  });

  it("reports a Card under a broken preview only once", () => {
    expect(messages(`<Value field="level" preview><Card /></Value>`)).toEqual([
      "error invalid-attribute: preview needs a field reached through a content field, like spell.name",
    ]);
  });
});

describe("sheetPreviewTarget", () => {
  const refs: SheetRefs = {
    d1: { name: "Sarenrae", contentTypeId: "deity", data: { domains: ["fire", "sun"] } },
  };
  const data = {
    deity: "d1",
    spells: ["missing", { name: "My Spell", rank: 1 }],
  };
  const root: SheetScope = { value: data, path: [] };

  it("finds referenced and local content", () => {
    const value = tag(`<Value field="deity.name" preview />`, "Value");
    expect(sheetPreviewTarget(value, root, root, refs)).toEqual({
      scope: { value: "d1", path: ["deity"] },
      record: { domains: ["fire", "sun"], name: "Sarenrae" },
      name: "Sarenrae",
      contentTypeId: "deity",
      id: "d1",
    });
    const column = tag(`<Table field="spells"><Column field="name" preview /></Table>`, "Column");
    const row: SheetScope = { value: data.spells[1], path: ["spells", 1], item: { key: 1 } };
    expect(sheetPreviewTarget(column, root, row, refs)).toMatchObject({
      record: { name: "My Spell", rank: 1 },
      name: "My Spell",
      contentTypeId: "spell",
    });
    // Not loaded: nothing to show.
    expect(sheetPreviewTarget(column, root, { value: "missing", path: ["spells", 0] }, refs)).toBeUndefined();
  });
});

describe("generatedCard", () => {
  it("shows tags, rows, and long text in schema order", () => {
    const long = "A".repeat(121);
    const card = generatedCard(
      {
        traits: { type: "array", itemType: { type: "string" } },
        traditions: {
          type: "array",
          itemType: { type: "string", options: [{ value: "arcane", label: "Arcane" }] },
        },
        rank: { type: "number", label: "Spell Rank" },
        kind: { type: "string", options: [{ value: "focus", label: "Focus" }] },
        range: { type: "string" },
        empty: { type: "string" },
        sustained: { type: "boolean" },
        deity: { type: "content", contentTypeId: "deity", allow: "reference" },
        heightened: { type: "string" },
        description: { type: "string" },
        weapon: { type: "struct", entries: { die: { type: "string" } } },
        levels: { type: "array", itemType: { type: "number" } },
      },
      {
        traits: ["fire", "manipulate"],
        traditions: ["arcane"],
        rank: 3,
        kind: "focus",
        range: "500 feet",
        empty: "",
        sustained: false,
        deity: "d1",
        heightened: "**+1** More damage.\nAnd more.",
        description: long,
        weapon: { die: "d6" },
        levels: [1, 2],
      },
      { d1: { name: "Sarenrae", contentTypeId: "deity", data: {} } },
    );
    expect(card).toEqual({
      tags: [
        { label: "Traits", values: ["fire", "manipulate"] },
        { label: "Traditions", values: ["Arcane"] },
      ],
      rows: [
        { label: "Spell Rank", text: "3" },
        { label: "Kind", text: "Focus" },
        { label: "Range", text: "500 feet" },
        { label: "Sustained", text: "No" },
        { label: "Deity", text: "Sarenrae" },
      ],
      texts: [
        { label: "Heightened", markdown: "**+1** More damage.\nAnd more." },
        { label: "Description", markdown: long },
      ],
    });
  });
});
