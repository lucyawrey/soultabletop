import { describe, expect, it } from "vitest";
import type { ContentTypeRules } from "../content-schema";
import {
  escapeSheetAttribute,
  generatedSheetDefaults,
  generateSheetMarkup,
} from "./generate";
import { parseSheetMarkup } from "./parser";
import { compileSheet, type SheetSchemas } from "./validate";

const item: ContentTypeRules = {
  hasStrictSchema: true,
  schema: {
    weight: { type: "number" },
    tags: { type: "array", itemType: { type: "string" } },
    lore: { type: "struct", entries: { origin: { type: "string" } } },
  },
};

const character: ContentTypeRules = {
  hasStrictSchema: true,
  schema: {
    hp: { type: "number", label: "Hit Points" },
    notes: { type: "string" },
    alive: { type: "boolean" },
    tags: { type: "array", itemType: { type: "string" } },
    extra: { type: "scalar" },
    link: { type: "resourceLink" },
    stats: {
      type: "struct",
      entries: {
        str: { type: "number" },
        saves: { type: "struct", entries: { fort: { type: "number" } } },
      },
    },
    attacks: {
      type: "array",
      itemType: {
        type: "struct",
        entries: { name: { type: "string" }, bonus: { type: "number" } },
      },
    },
    inventory: {
      type: "array",
      itemType: {
        type: "struct",
        entries: {
          item: { type: "content", contentTypeId: "item", allow: "both" },
          qty: { type: "number" },
        },
      },
    },
    spells: {
      type: "array",
      itemType: {
        type: "struct",
        entries: {
          name: { type: "string" },
          components: { type: "array", itemType: { type: "string" } },
        },
      },
    },
    rolls: { type: "array", itemType: { type: "number" } },
    grid: { type: "array", itemType: { type: "array", itemType: { type: "number" } } },
    feats: { type: "array", itemType: { type: "content", contentTypeId: "item", allow: "reference" } },
    mainHand: { type: "content", contentTypeId: "item", allow: "both" },
  },
};

const schemas: SheetSchemas = { root: character, types: { item } };

describe("generateSheetMarkup", () => {
  it("produces markup that validates with no diagnostics", () => {
    const markup = generateSheetMarkup(schemas);
    expect(compileSheet(markup, schemas).diagnostics).toEqual([]);
  });

  it("also validates for non-strict schemas and missing referenced types", () => {
    const loose: SheetSchemas = {
      root: { ...character, hasStrictSchema: false },
      types: {},
    };
    const { diagnostics } = compileSheet(generateSheetMarkup(loose), loose);
    // Only warnings about the ContentType that wasn't loaded.
    expect(diagnostics.every((item) => item.severity === "warning")).toBe(true);
  });

  it("lays out fields in schema order: details first, then a section per complex field", () => {
    const markup = generateSheetMarkup(schemas);
    expect(markup).toMatchInlineSnapshot(`
      "<Section title="Details">
        <Grid cols="2">
          <Text field="name" />
          <Field field="hp" />
          <Field field="notes" />
          <Field field="alive" />
          <Field field="tags" />
          <Field field="extra" />
          <Field field="link" />
        </Grid>
      </Section>
      <Section title="Stats">
        <Grid cols="2">
          <Field field="stats.str" />
        </Grid>
        <Section title="Saves">
          <Grid cols="2">
            <Field field="stats.saves.fort" />
          </Grid>
        </Section>
      </Section>
      <Section title="Attacks">
        <Table field="attacks">
          <Column field="name" />
          <Column field="bonus" />
        </Table>
      </Section>
      <Section title="Inventory">
        <Table field="inventory">
          <Column field="item" />
          <Column field="qty" />
        </Table>
      </Section>
      <Section title="Spells">
        <List field="spells">
          <Grid cols="2">
            <Field field="name" />
            <Field field="components" />
          </Grid>
        </List>
      </Section>
      <Section title="Rolls">
        <List field="rolls">
          <Field field="." />
        </List>
      </Section>
      <Section title="Grid">
        <Value field="grid" />
      </Section>
      <Section title="Feats">
        <List field="feats">
          <Collapsible title="{name}">
            <Ref field="." />
            <Grid cols="2">
              <Field field="weight" />
              <Field field="tags" />
            </Grid>
          </Collapsible>
        </List>
      </Section>
      <Section title="Main Hand">
        <Ref field="mainHand" />
        <Grid cols="2">
          <Field field="mainHand.weight" />
          <Field field="mainHand.tags" />
        </Grid>
      </Section>
      "
    `);
  });

  it("uses schema labels and escapes them", () => {
    const tricky: SheetSchemas = {
      root: {
        hasStrictSchema: true,
        schema: {
          stats: {
            type: "struct",
            label: "Stats \"&\" {bonus} <x> \\",
            entries: {},
          },
        },
      },
      types: {},
    };
    const markup = generateSheetMarkup(tricky);
    const result = compileSheet(markup, tricky);
    expect(result.diagnostics).toEqual([]);
    const parsed = parseSheetMarkup(markup).nodes[1];
    expect(parsed?.type === "element" && parsed.attrs[0]?.value).toEqual([
      "Stats \"&\" {bonus} <x> \\",
    ]);
  });

  it("handles an empty schema", () => {
    const empty: SheetSchemas = { root: { hasStrictSchema: true, schema: {} }, types: {} };
    const markup = generateSheetMarkup(empty);
    expect(markup).toBe(
      "<Section title=\"Details\">\n  <Grid cols=\"2\">\n    <Text field=\"name\" />\n  </Grid>\n</Section>\n",
    );
    expect(compileSheet(markup, empty).diagnostics).toEqual([]);
  });
});

describe("escapeSheetAttribute", () => {
  it("escapes everything the parser treats specially", () => {
    expect(escapeSheetAttribute("a\\b{c}\"d\"&<e>")).toBe(
      "a\\\\b\\{c\\}&quot;d&quot;&amp;&lt;e>",
    );
  });
});

describe("generatedSheetDefaults", () => {
  it.each([
    ["playerCharacter", true, true, "box"],
    ["nonPlayerCharacter", false, true, "text"],
    ["general", false, false, "text"],
    ["page", false, false, "text"],
  ] as const)("%s", (category, defaultEditMode, defaultAutosave, defaultDisplay) => {
    expect(generatedSheetDefaults(category)).toEqual({
      defaultEditMode,
      defaultAutosave,
      defaultDisplay,
    });
  });
});

describe("generated sheets with choice fields", () => {
  it("uses Field for choice fields and arrays of them, and validates", () => {
    const choiceSchemas: SheetSchemas = {
      root: {
        hasStrictSchema: true,
        schema: {
          size: { type: "string", options: [{ value: "s" }] },
          ranks: { type: "array", itemType: { type: "number", options: [{ value: 1 }] } },
        },
      },
      types: {},
    };
    const markup = generateSheetMarkup(choiceSchemas);
    expect(markup).toContain('<Field field="size" />');
    expect(markup).toContain('<Field field="ranks" />');
    expect(compileSheet(markup, choiceSchemas).diagnostics).toEqual([]);
  });
});

describe("generated sheets with structs of alike structs", () => {
  it("shows them as a Table with a label column, and validates", () => {
    const rank = { type: "struct" as const, entries: { rank: { type: "number" as const }, notes: { type: "string" as const } } };
    const structSchemas: SheetSchemas = {
      root: {
        hasStrictSchema: true,
        schema: { skills: { type: "struct", entries: { acrobatics: rank, arcana: rank } } },
      },
      types: {},
    };
    const markup = generateSheetMarkup(structSchemas);
    expect(markup).toContain(`<Section title="Skills">
  <Table field="skills">
    <Column formula="itemLabel()" />
    <Column field="rank" />
    <Column field="notes" />
  </Table>
</Section>`);
    expect(compileSheet(markup, structSchemas).diagnostics).toEqual([]);
  });
});
