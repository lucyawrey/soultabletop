import { describe, expect, it } from "vitest";
import type { ContentTypeRules } from "../content-schema";
import { parseSheetMarkup } from "./parser";
import { humanizeFieldName } from "./registry";
import {
  compileSheet,
  hasErrors,
  parseSheetPath,
  validateSheet,
  type SheetSchemas,
  type ValidatedElement,
  type ValidatedNode,
} from "./validate";

const itemType: ContentTypeRules = {
  hasStrictSchema: true,
  schema: { weight: { type: "number" }, cost: { type: "string" } },
};

// A class can reference a subclass of the same type, to test depth limits.
const classType: ContentTypeRules = {
  hasStrictSchema: true,
  schema: {
    hitDie: { type: "number" },
    sub: { type: "content", contentTypeId: "cls", allow: "reference" },
  },
};

const character: ContentTypeRules = {
  hasStrictSchema: true,
  schema: {
    hp: { type: "number", label: "Hit Points" },
    hpMax: { type: "number" },
    notes: { type: "string", description: "Anything goes" },
    alive: { type: "boolean" },
    tags: { type: "array", itemType: { type: "string" } },
    stats: { type: "struct", entries: { str: { type: "number" } } },
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
    class: { type: "content", contentTypeId: "cls", allow: "reference" },
    link: { type: "resourceLink" },
    extra: { type: "scalar" },
    misc: { type: "object" },
  },
};

const schemas: SheetSchemas = {
  root: character,
  types: { item: itemType, cls: classType },
};

function compile(markup: string, withSchemas: SheetSchemas = schemas) {
  return compileSheet(markup, withSchemas);
}

function messages(markup: string, withSchemas: SheetSchemas = schemas) {
  return compile(markup, withSchemas).diagnostics.map(
    (item) => `${item.severity} ${item.code}: ${item.message}`,
  );
}

function errorCodes(markup: string, withSchemas: SheetSchemas = schemas) {
  return compile(markup, withSchemas)
    .diagnostics.filter((item) => item.severity === "error")
    .map((item) => item.code);
}

function first(nodes: ValidatedNode[]) {
  const node = nodes[0];
  expect(node?.type).toBe("element");
  return node as ValidatedElement;
}

describe("valid sheets", () => {
  it("accepts a realistic character sheet without diagnostics", () => {
    const markup = `
      <Sheet>
        <Heading>{/name}</Heading>
        <Grid cols="3" gap="lg">
          <Section title="Vitals" icon="i-lucide-heart" span="2" collapsible>
            <Tracker field="hp" max="{hpMax}" style="pips" live />
            <Number field="stats.str" variant="stat" />
            <Toggle field="alive" />
            <Text field="notes" multiline placeholder="Write here" />
          </Section>
          <Tabs>
            <Tab label="Attacks">
              <Table field="attacks">
                <Column field="name" width="md" />
                <Column field="bonus" />
                <RowDetails><Note>Rolled by {/name}</Note></RowDetails>
              </Table>
            </Tab>
            <Tab label="Inventory">
              <List field="inventory" layout="grid" cols="2" addLabel="Add item">
                <Collapsible title="{item.name}" subtitle="x{qty}">
                  <Value field="item.weight" format="signed" />
                  <Ref field="item" />
                </Collapsible>
              </List>
            </Tab>
          </Tabs>
          <Tags field="tags" />
          <Select field="notes" options="a, b ,c" />
          <Ref field="class" locked />
          <Number field="class.hitDie" />
          <Field field="link" />
          <Divider label="End" />
          <Callout color="warning" title="Careful">Watch out, {name}.</Callout>
          <Badge class="pill big">New</Badge>
        </Grid>
      </Sheet>`;
    expect(messages(markup)).toEqual([]);
  });

  it("matches tag, attribute, and enum names case-insensitively", () => {
    const result = compile(`<section TITLE="x"><grid COLS="2" gap="LG"><number FIELD="hp" /></grid></section>`);
    expect(result.diagnostics).toEqual([]);
    const section = first(result.nodes);
    expect(section.tag).toBe("Section");
    expect(section.attrs).toEqual({ title: ["x"] });
    const grid = first(section.children);
    expect(grid.attrs).toEqual({ cols: 2, gap: "lg" });
  });

  it("types attribute values", () => {
    const node = first(compile(
      `<Number field="hp" min="-3" max="{hpMax}" step="0.5" live="false" locked="true" display="box" class="a b-c" />`,
    ).nodes);
    expect(node.attrs).toMatchObject({
      field: "hp",
      min: -3,
      max: { path: "hpMax" },
      step: 0.5,
      live: false,
      locked: true,
      display: "box",
      class: ["a", "b-c"],
    });
  });

  it("accepts display on any tag, with text or box only", () => {
    expect(messages(`<Section display="text"><Grid display="box" /></Section>`)).toEqual([]);
    expect(messages(`<Section display="boxed" />`)).toEqual([
      "error invalid-attribute: display on <Section> must be one of: text, box",
    ]);
  });
});

describe("bindings", () => {
  it("uses the schema label and description, else a humanized name", () => {
    const result = compile(`<Number field="hp" /><Text field="notes" /><Number field="stats.str" /><Text field="name" />`);
    const labels = result.nodes.map((node) => {
      const element = node as ValidatedElement;
      return [element.binding?.label, element.binding?.description];
    });
    expect(labels).toEqual([
      ["Hit Points", undefined],
      ["Notes", "Anything goes"],
      ["Str", undefined],
      ["Name", undefined],
    ]);
  });

  it("records parsed paths", () => {
    const list = first(compile(`<List field="tags"><Text field="." /></List>`).nodes);
    expect(list.binding?.path).toEqual({ absolute: false, segments: ["tags"] });
    expect(first(list.children).binding?.path).toEqual({ absolute: false, segments: [] });
    expect(parseSheetPath("/a.b")).toEqual({ absolute: true, segments: ["a", "b"] });
  });

  it("rejects fields a tag can't show, with a hint", () => {
    expect(messages(`<Number field="notes" />`)).toEqual([
      "error wrong-field-type: <Number> can't show \"notes\": it's a text field",
    ]);
    expect(messages(`<Text field="attacks" />`)).toEqual([
      "error wrong-field-type: <Text> can't show \"attacks\": it's an array; use <List> or <Table>",
    ]);
    expect(messages(`<Field field="stats" />`)).toEqual([
      "error wrong-field-type: <Field> can't show \"stats\": it's a struct; use a <Section> with fields inside",
    ]);
    expect(errorCodes(`<Table field="tags"><Column field="." /></Table>`)).toEqual(["wrong-field-type"]);
    expect(errorCodes(`<Tags field="attacks" />`)).toEqual(["wrong-field-type"]);
  });

  it("binds scalar fields to Field, Value, and Column only", () => {
    expect(messages(`<Field field="extra" /><Value field="extra" />`)).toEqual([]);
    expect(messages(`<Number field="extra" />`)).toEqual([
      "error wrong-field-type: <Number> can't show \"extra\": it's a scalar field",
    ]);
    expect(messages(`<Text field="extra.a" />`)).toEqual([
      "error not-an-object: \"extra.a\": \"extra\" is a scalar field and has no field \"a\"",
    ]);
  });

  it("allows unchecked paths into free-form objects, with a warning", () => {
    expect(messages(`<Field field="misc" />`)).toEqual([]);
    expect(messages(`<Number field="misc.a.b" /><List field="misc.items"><Text field="x" /></List>`)).toEqual([
      "warning free-form-path: \"misc.a.b\": \"misc\" is a free-form object, so \"a\" isn't checked; it will show whatever the data holds",
      "warning free-form-path: \"misc.items\": \"misc\" is a free-form object, so \"items\" isn't checked; it will show whatever the data holds",
    ]);
  });

  it("lets Value show anything", () => {
    expect(messages(`<Value field="stats" /><Value field="attacks" /><Value field="class" />`)).toEqual([]);
  });
});

describe("paths", () => {
  it("errors on unknown fields in strict schemas", () => {
    expect(messages(`<Number field="mana" /><Number field="stats.dex" />`)).toEqual([
      "error unknown-field: \"mana\": the schema has no field \"mana\"",
      "error unknown-field: \"stats.dex\": \"stats\" has no field \"dex\"",
    ]);
  });

  it("only warns about unknown fields in non-strict schemas, and still renders", () => {
    const loose: SheetSchemas = { ...schemas, root: { ...character, hasStrictSchema: false } };
    const result = compile(`<Number field="mana" />`, loose);
    expect(result.diagnostics.map((item) => [item.severity, item.code])).toEqual([["warning", "unknown-field"]]);
    expect(hasErrors(result.diagnostics)).toBe(false);
    expect(first(result.nodes).binding?.field).toBeUndefined();
  });

  it("resolves paths inside a List relative to the item, and / from the top", () => {
    expect(messages(`<List field="attacks"><Text field="name" /><Number field="bonus" /><Number field="/hp" />{name} {/name}</List>`)).toEqual([]);
    expect(errorCodes(`<List field="attacks"><Number field="hp" /></List>`)).toEqual(["unknown-field"]);
  });

  it("uses . for items of primitive lists and rejects field names there", () => {
    expect(messages(`<List field="tags"><Text field="." />{.}</List>`)).toEqual([]);
    expect(messages(`<List field="tags"><Text field="name" /></List>`)).toEqual([
      "error not-an-object: \"name\": \"\" is a text field and has no field \"name\"",
    ]);
  });

  it("supports array indexes but not field names on arrays", () => {
    expect(messages(`<Text field="attacks.0.name" />`)).toEqual([]);
    expect(messages(`<Text field="attacks.name" />`)).toEqual([
      "error not-an-object: \"attacks.name\": \"attacks\" is an array; use an index like attacks.0, or a <List>",
    ]);
  });

  it("rejects fields of primitive values", () => {
    expect(errorCodes(`<Text field="notes.length" />`)).toEqual(["not-an-object"]);
  });

  it("follows content fields into the referenced ContentType, with a name field", () => {
    expect(messages(`<Number field="class.hitDie" /><Text field="class.name" /><List field="inventory"><Number field="item.weight" /><Text field="item.name" /></List>`)).toEqual([]);
    expect(errorCodes(`<Number field="class.level" />`)).toEqual(["unknown-field"]);
  });

  it("allows up to 3 content fields in a path", () => {
    expect(messages(`<Number field="class.sub.sub.hitDie" />`)).toEqual([]);
    expect(messages(`<Number field="class.sub.sub.sub.hitDie" />`)).toEqual([
      "error content-too-deep: \"class.sub.sub.sub\" goes through more than 3 content fields",
    ]);
  });

  it("warns when a referenced ContentType wasn't loaded", () => {
    const partial: SheetSchemas = { ...schemas, types: {} };
    const result = compile(`<Number field="class.hitDie" />`, partial);
    expect(result.diagnostics.map((item) => [item.severity, item.code])).toEqual([["warning", "missing-content-type"]]);
  });

  it("checks {paths} in text and attributes", () => {
    expect(errorCodes(`<Note>{nope}</Note><Section title="{nope2}" />`)).toEqual(["unknown-field", "unknown-field"]);
    expect(messages(`<Note>{stats}</Note>`)).toEqual([
      "warning interpolates-object: {stats} is an object and will show as raw data",
    ]);
  });

  it("requires number attributes given as {path} to point at numbers", () => {
    expect(messages(`<Tracker field="hp" max="{notes}" />`)).toEqual([
      "error invalid-attribute: max=\"{notes}\" must point at a number field, but it's a text field",
    ]);
  });
});

describe("tags and attributes", () => {
  it("replaces unknown tags with invalid nodes and keeps siblings", () => {
    const result = compile(`<Stat field="hp" /><Number field="hp" />`);
    expect(result.diagnostics.map((item) => item.message)).toEqual(["Unknown tag <Stat>"]);
    expect(result.nodes.map((node) => node.type)).toEqual(["invalid", "element"]);
  });

  it("reports unknown attributes but keeps the tag", () => {
    const result = compile(`<Divider color="red" />`);
    expect(result.diagnostics.map((item) => item.message)).toEqual([
      "<Divider> has no color attribute (it has: label)",
    ]);
    expect(result.nodes[0]?.type).toBe("element");
  });

  it("marks tags with missing or unusable required attributes invalid", () => {
    expect(messages(`<Tabs><Tab>x</Tab></Tabs>`)).toEqual([
      "error missing-attribute: <Tab> needs a label attribute",
    ]);
    expect(compile(`<Number />`).nodes[0]?.type).toBe("invalid");
    const bad = compile(`<Number field="not a path" />`);
    expect(bad.nodes[0]?.type).toBe("invalid");
    expect(bad.diagnostics).toHaveLength(1);
  });

  it("accepts hideLabel on every field tag and Column, and format on Number", () => {
    expect(
      messages(
        `<Number field="hp" hideLabel /><Text field="notes" hideLabel="true" /><Field field="notes" hideLabel="false" />` +
          `<Number field="hp" format="signed" variant="stat" /><Value field="hp" format="signed" hideLabel />` +
          `<Select field="notes" options="a,b" hideLabel />`,
      ),
    ).toEqual([]);
    expect(messages(`<Table field="attacks"><Column field="name" hideLabel /></Table>`)).toEqual([]);
  });

  it("rejects bad hideLabel and format values, and hideLabel on non-field tags", () => {
    expect(errorCodes(`<Number field="hp" hideLabel="maybe" />`)).toEqual(["invalid-attribute"]);
    expect(errorCodes(`<Number field="hp" format="roman" />`)).toEqual(["invalid-attribute"]);
    expect(messages(`<Divider hideLabel />`)).toEqual([
      "error unknown-attribute: <Divider> has no hideLabel attribute (it has: label)",
    ]);
  });

  it("keeps hideLabel and the resolved label on the validated node", () => {
    const node = first(compile(`<Number field="hp" hideLabel />`).nodes);
    expect(node.attrs.hideLabel).toBe(true);
    expect(node.binding?.label).toBe("Hit Points");
  });

  it("validates attribute values", () => {
    expect(messages(`<Grid cols="0" gap="huge"><Section span="1.5" icon="sword" class="Bad_name" /></Grid>`)).toEqual([
      "error invalid-attribute: cols on <Grid> must be between 1 and 12",
      "error invalid-attribute: gap on <Grid> must be one of: none, sm, md, lg",
      "error invalid-attribute: span on <Section> must be a whole number",
      "error invalid-attribute: icon must be an icon name like i-lucide-sword",
      "error invalid-attribute: Class \"Bad_name\" must use lowercase letters, numbers, and hyphens, starting with a letter",
    ]);
    expect(errorCodes(`<Grid cols />`)).toEqual(["invalid-attribute"]);
    expect(errorCodes(`<Grid cols="{hp} x" />`)).toEqual(["invalid-attribute"]);
    expect(errorCodes(`<Section collapsible="maybe" />`)).toEqual(["invalid-attribute"]);
    expect(errorCodes(`<Grid gap="{notes}" />`)).toEqual(["invalid-attribute"]);
    expect(errorCodes(`<Select field="notes" options=" , " />`)).toEqual(["invalid-attribute"]);
  });
});

describe("placement", () => {
  it.each([
    [`<Tab label="x" />`, "<Tab> must be directly inside <Tabs>"],
    [`<Column field="hp" />`, "<Column> must be directly inside <Table>"],
    [`<Section><Sheet /></Section>`, "<Sheet> must be the outermost tag"],
    [`<Tabs><Section /></Tabs>`, "<Tabs> can only contain <Tab>"],
    [`<Tabs>loose text</Tabs>`, "<Tabs> can't contain text"],
    [`<Divider><Note>x</Note></Divider>`, "<Divider> can't contain other tags"],
    [`<Divider>x</Divider>`, "<Divider> can't contain text"],
    [`<Heading><Badge>x</Badge></Heading>`, "<Heading> can only contain text"],
    [`<Table field="attacks"><Note>x</Note></Table>`, "<Table> can only contain <Column> and <RowDetails>"],
  ])("rejects %s", (markup, message) => {
    expect(compile(markup).diagnostics.map((item) => item.message)).toEqual([message]);
  });
});

describe("compileSheet", () => {
  it("merges parser and validator diagnostics in source order", () => {
    const result = compile(`<Nope />\n<Grid cols=2></Grid>\n<Number field="mana" />`);
    expect(result.diagnostics.map((item) => [item.loc.start.line, item.code])).toEqual([
      [1, "unknown-tag"],
      [2, "unquoted-attribute"],
      [3, "unknown-field"],
    ]);
    expect(hasErrors(result.diagnostics)).toBe(true);
  });

  it("validates already-parsed nodes", () => {
    const { nodes } = parseSheetMarkup(`<Number field="hp" />`);
    expect(validateSheet(nodes, schemas).diagnostics).toEqual([]);
  });
});

describe("humanizeFieldName", () => {
  it.each([
    ["hitPoints", "Hit Points"],
    ["hit_points", "Hit Points"],
    ["str", "Str"],
    ["armorClass2", "Armor Class2"],
    ["HP", "HP"],
  ])("%s -> %s", (key, label) => {
    expect(humanizeFieldName(key)).toBe(label);
  });
});
