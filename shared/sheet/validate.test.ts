import { describe, expect, it } from "vitest";
import type { ContentTypeRules } from "../content-schema";
import { pathfinder2eMarkup, pathfinder2eSchemas } from "./fixtures/pathfinder2e";
import type { FormulaNode } from "./formula";
import { parseSheetMarkup } from "./parser";
import { humanizeFieldName } from "./registry";
import {
  compileSheet,
  hasErrors,
  newSheetErrors,
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
  showSheetWarnings: true,
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
      max: { source: "hpMax", type: { kind: "number" } },
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
      "error wrong-field-type: <Field> can't show \"stats\": it's a struct; use a <Section> with fields inside, or a <List> over its entries",
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

describe("showSheetWarnings", () => {
  const withRoot = (patch: Partial<ContentTypeRules>): SheetSchemas => ({
    ...schemas,
    root: { ...character, ...patch },
  });
  const markup = `<Number field="mana" /><Callout title="x">{mana}</Callout><Number field="misc.a" />`;
  const codes = (withSchemas: SheetSchemas) =>
    compile(markup, withSchemas).diagnostics.map((item) => `${item.severity} ${item.code}`);

  it("hides not-in-schema and free-form warnings when off (or missing)", () => {
    expect(codes(withRoot({ hasStrictSchema: false, showSheetWarnings: false }))).toEqual([]);
    expect(codes(withRoot({ hasStrictSchema: false, showSheetWarnings: undefined }))).toEqual([]);
    expect(codes(withRoot({ hasStrictSchema: true, showSheetWarnings: false })).filter((c) => c.startsWith("warning"))).toEqual([]);
  });

  it("shows them when on", () => {
    expect(codes(withRoot({ hasStrictSchema: false, showSheetWarnings: true }))).toEqual([
      "warning unknown-field",
      "warning unknown-field",
      "warning free-form-path",
    ]);
  });

  it("never changes errors, whatever the option", () => {
    const broken = `<Number field="mana" /><Number field="name" /><Frobnicate />`;
    for (const hasStrictSchema of [true, false]) {
      const on = errorCodes(broken, withRoot({ hasStrictSchema, showSheetWarnings: true }));
      expect(on.length).toBeGreaterThan(0);
      expect(errorCodes(broken, withRoot({ hasStrictSchema, showSheetWarnings: false }))).toEqual(on);
    }
    expect(errorCodes(`<Number field="mana" />`, withRoot({ hasStrictSchema: true, showSheetWarnings: false }))).toEqual(["unknown-field"]);
  });

  it("uses the root content type's flag, not a referenced one's", () => {
    const loose = { ...itemType, hasStrictSchema: false };
    const off = { root: { ...character, showSheetWarnings: false }, types: { ...schemas.types, item: { ...loose, showSheetWarnings: true } } };
    expect(codes(off).filter((c) => c.startsWith("warning"))).toEqual([]);
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
    expect(errorCodes(`<Note>{stats}</Note>`)).toEqual(["formula-result-type"]);
  });

  it("requires number attributes given as {path} to point at numbers", () => {
    expect(messages(`<Tracker field="hp" max="{notes}" />`)).toEqual([
      "error formula-result-type: max must be a number, but {notes} gives text",
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

  it("rejects live, locked, and display on Tab and RowDetails, which their parents render", () => {
    expect(
      messages(`<Tabs><Tab label="A" display="text" live locked>x</Tab></Tabs>`),
    ).toEqual([
      "error unknown-attribute: <Tab> has no display attribute (it has: label, icon)",
      "error unknown-attribute: <Tab> has no live attribute (it has: label, icon)",
      "error unknown-attribute: <Tab> has no locked attribute (it has: label, icon)",
    ]);
    expect(
      messages(
        `<Table field="attacks"><Column field="name" /><RowDetails locked>x</RowDetails></Table>`,
      ),
    ).toEqual(["error unknown-attribute: <RowDetails> has no locked attribute"]);
  });

  it("still accepts the other attributes on Tab and RowDetails", () => {
    expect(
      messages(`<Tabs><Tab label="A" icon="i-lucide-swords" class="main">x</Tab></Tabs>`),
    ).toEqual([]);
    expect(
      messages(
        `<Table field="attacks"><Column field="name" /><RowDetails class="more">x</RowDetails></Table>`,
      ),
    ).toEqual([]);
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

describe("formulas", () => {
  function element(markup: string) {
    const [node] = compile(markup).nodes;
    expect(node?.type).toBe("element");
    return node as ValidatedElement;
  }

  it("compiles formulas on field tags, with their result type", () => {
    expect(messages('<Value formula="hp * 2" label="Double" />')).toEqual([]);
    const node = element('<Value formula="hp * 2" label="Double" />');
    expect(node.binding).toBeUndefined();
    expect(node.formula?.type).toEqual({ kind: "number" });
    expect(node.formula?.ast).toMatchObject({ type: "binary", op: "*" });
  });

  it("needs a field or a formula on field tags, and not both unless the tag overrides", () => {
    expect(errorCodes("<Value />")).toEqual(["missing-attribute"]);
    expect(messages("<Value />")[0]).toMatch(/needs a field or formula attribute/);
    expect(messages("<Image />")[0]).toMatch(/needs a field attribute$/);
    expect(messages('<Value field="hp" formula="1" />')).toEqual([
      "error invalid-attribute: <Value> takes field or formula, not both",
    ]);
    expect(messages('<Number field="hp" formula="hpMax" />')).toEqual([]);
    expect(messages('<Text field="notes" formula="concat(\'x\', hp)" />')).toEqual([]);
    expect(messages('<Checkbox field="alive" formula="hp > 0" />')).toEqual([]);
  });

  it("takes formula only on the tags that support it", () => {
    for (const tag of ["Image", "Ref", "Markdown", "Select", "Tags", "Toggle"]) {
      expect(errorCodes(`<${tag} field="notes" formula="1" />`), tag).toContain("unknown-attribute");
    }
    expect(errorCodes('<List field="tags" formula="1"><Value field="." /></List>')).toContain(
      "unknown-attribute",
    );
  });

  it("lets Field take a formula on a text, number, or true/false field", () => {
    expect(messages('<Field field="hp" formula="hpMax" />')).toEqual([]);
    expect(messages('<Field field="notes" formula="concat(\'x\', hp)" />')).toEqual([]);
    expect(messages('<Field field="alive" formula="hp > 0" />')).toEqual([]);
    expect(messages('<Field field="hp" formula="notes" />')).toEqual([
      "error formula-result-type: <Field>'s formula must give a number, but it gives text",
    ]);
    for (const field of ["class", "link", "extra", "misc"])
      expect(errorCodes(`<Field field="${field}" formula="1" />`), field).toContain("invalid-attribute");
    expect(errorCodes('<Field formula="1" />')).toEqual(["missing-attribute"]);
    const { computedFields } = compile('<Field field="hpMax" formula="10" />');
    expect(computedFields.get("hpMax")).toMatchObject({ tag: "Number", source: "10" });
  });

  it("checks that the result fits the tag and the field", () => {
    expect(messages('<Number formula="notes" />')).toEqual([
      "error formula-result-type: <Number>'s formula must give a number, but it gives text",
    ]);
    expect(errorCodes('<Checkbox formula="hp" />')).toEqual(["formula-result-type"]);
    expect(errorCodes('<Text formula="hp" />')).toEqual(["formula-result-type"]);
    expect(errorCodes('<Tracker formula="notes" max="10" />')).toEqual(["formula-result-type"]);
    expect(messages('<Value formula="tags" />')).toEqual([
      "error formula-result-type: The formula gives a list; <Value> shows a single value (use sum, count, or join)",
    ]);
    expect(messages('<Table field="attacks"><Column formula="bonus + 1" format="signed" /></Table>')).toEqual([]);
    expect(errorCodes('<Value formula="extra" />')).toEqual([]);
    expect(errorCodes('<Value formula="misc.anything" />')).toEqual([]);
  });

  it("warns that live and locked do nothing on a computed value", () => {
    expect(messages('<Value formula="hp" live />')).toEqual([
      "warning flag-no-effect: live has no effect on <Value> with a formula and no field: a computed value can't be edited",
    ]);
    expect(messages('<Number field="hp" formula="hpMax" live locked />')).toEqual([]);
  });

  it("resolves formula paths through the schema, in List scope", () => {
    expect(messages('<Value formula="nope + 1" />')).toEqual([
      'error unknown-field: "nope": the schema has no field "nope"',
    ]);
    expect(messages('<List field="attacks"><Value formula="bonus + /hp" /></List>')).toEqual([]);
    expect(errorCodes('<List field="attacks"><Value formula="hp" /></List>')).toEqual(["unknown-field"]);
    expect(messages('<Value formula="sum(inventory, qty * coalesce(item.weight, 0))" />')).toEqual([]);
    expect(errorCodes('<Value formula="sum(inventory, item.nope)" />')).toEqual(["unknown-field"]);
    expect(messages('<Value formula="class.sub.sub.hitDie" />')).toEqual([]);
    expect(errorCodes('<Value formula="class.sub.sub.sub.hitDie" />')).toEqual(["content-too-deep"]);
  });

  it("puts diagnostics at their place inside the attribute", () => {
    const [diagnostic] = compile('<Sheet>\n  <Value formula="hp +\n    nope" />\n</Sheet>').diagnostics;
    expect(diagnostic).toMatchObject({
      code: "unknown-field",
      loc: { start: { line: 3, column: 5 }, end: { line: 3, column: 9 } },
    });
    const [syntax] = compile('<Value formula="hp + * 2" />').diagnostics;
    expect(syntax).toMatchObject({ code: "formula-syntax", loc: { start: { line: 1, column: 22 } } });
    const [inText] = compile("<Note>HP {hp +}</Note>").diagnostics;
    expect(inText).toMatchObject({ code: "formula-syntax", loc: { start: { column: 15 } } });
  });

  it("reports type errors, unknown functions, arity, and dice", () => {
    expect(errorCodes('<Value formula="notes + 1" />')).toEqual(["formula-type"]);
    expect(errorCodes('<Value formula="nope(1)" />')).toEqual(["formula-unknown-function"]);
    expect(errorCodes('<Value formula="floor()" />')).toEqual(["formula-arity"]);
    expect(messages('<Value formula="2d6 + hp" />')).toEqual([
      "error formula-dice: Dice rolls aren't available here yet",
    ]);
  });

  it("explains a double quote that ends a formula attribute", () => {
    expect(messages('<Value formula="concat("a", hp)" />')[0]).toBe(
      "error formula-syntax: The formula ends at this \"; inside formula=\"…\", write text in single quotes, like 'expert'",
    );
  });

  it("compiles {} in text and attributes", () => {
    const { nodes, diagnostics } = compile('<Section title="HP {hp * 2}">Max {hpMax}</Section>');
    expect(diagnostics).toEqual([]);
    const section = nodes[0] as ValidatedElement;
    expect((section.attrs.title as unknown[])[1]).toMatchObject({ formula: "hp * 2", ast: { type: "binary" } });
    expect(section.children[0]).toMatchObject({ type: "text", parts: ["Max ", { ast: { type: "path" } }] });
    expect(errorCodes("<Note>{tags}</Note>")).toEqual(["formula-result-type"]);
  });

  it("takes number attributes as {formula}", () => {
    expect(messages('<Tracker field="hp" max="{hpMax + stats.str}" />')).toEqual([]);
    const node = element('<Tracker field="hp" max="{hpMax * 2}" />');
    expect(node.attrs.max).toMatchObject({ source: "hpMax * 2", type: { kind: "number" } });
    expect(messages('<Tracker field="hp" max="{notes}" />')).toEqual([
      "error formula-result-type: max must be a number, but {notes} gives text",
    ]);
  });

  it("limits formulas per sheet", () => {
    const many = Array.from({ length: 2_001 }, () => "{1}").join(" ");
    expect(errorCodes(`<Note>${many}</Note>`)).toEqual(["formula-too-large"]);
  });
});

describe("definitions", () => {
  it("collects definitions in any order, with params and types", () => {
    const { diagnostics, definitions } = compile(`
      <Value formula="double(hp) + base()" />
      <Define name="double" params="x" formula="x * 2" />
      <Sheet><Define name="base" formula="hpMax + /stats.str" /></Sheet>
    `);
    expect(diagnostics).toEqual([]);
    expect(definitions.get("double")).toMatchObject({ params: ["x"], broken: false, type: { kind: "number" } });
    expect(definitions.get("base")?.ast).toBeDefined();
  });

  it("lets parameters hide fields only in their definition", () => {
    expect(messages('<Define name="f" params="hp" formula="hp + /hp" /><Value formula="hp + f(1)" />')).toEqual([]);
    expect(errorCodes('<Define name="f" params="x" formula="x" /><Value formula="x" />')).toEqual(["unknown-field"]);
  });

  it("checks names, params, and placement", () => {
    expect(messages('<Define name="floor" formula="1" />')).toEqual([
      "error formula-reserved-name: floor is a built-in name; choose another name for this definition",
    ]);
    expect(errorCodes('<Define name="roll" formula="1" />')).toEqual(["formula-reserved-name"]);
    expect(errorCodes('<Define name="and" formula="1" />')).toEqual(["formula-reserved-name"]);
    expect(errorCodes('<Define name="a" formula="1" /><Define name="a" formula="2" />')).toEqual([
      "duplicate-definition",
    ]);
    expect(errorCodes('<Define name="2a" formula="1" />')).toEqual(["invalid-attribute"]);
    expect(errorCodes('<Define name="__proto__" formula="1" />')).toEqual(["invalid-attribute"]);
    expect(errorCodes('<Define name="a" params="x, x" formula="1" />')).toEqual(["invalid-attribute"]);
    expect(errorCodes('<Define name="a" params="not" formula="1" />')).toEqual(["invalid-attribute"]);
    expect(errorCodes('<Define name="a" params="a,b,c,d,e,f,g,h,i" formula="1" />')).toEqual([
      "invalid-attribute",
    ]);
    expect(errorCodes('<Define formula="1" />')).toEqual(["missing-attribute"]);
    expect(messages('<Section><Define name="a" formula="1" /></Section>')).toEqual([
      "error misplaced-tag: <Define> must be at the top level or directly inside <Sheet>",
    ]);
    expect(errorCodes('<Define name="a" formula="1" class="x" />')).toEqual(["unknown-attribute"]);
  });

  it("checks calls against definitions", () => {
    expect(messages('<Define name="f" params="x" formula="x" /><Value formula="f()" />')).toEqual([
      "error formula-arity: f takes 1 argument (x)",
    ]);
    expect(errorCodes('<Define name="t" formula="\'a\'" /><Number formula="t()" />')).toEqual([
      "formula-result-type",
    ]);
  });

  it("reports every definition in a cycle and marks them broken", () => {
    const { diagnostics, definitions } = compile(`
      <Define name="a" formula="b() + 1" />
      <Define name="b" formula="a()" />
      <Define name="c" formula="c()" />
      <Define name="d" formula="a()" />
    `);
    expect(diagnostics.map((item) => item.message)).toEqual([
      "a calls itself: a() → b() → a()",
      "b calls itself: b() → a() → b()",
      "c calls itself: c() → c()",
    ]);
    expect([...definitions.values()].map((item) => [item.name, item.broken])).toEqual([
      ["a", true],
      ["b", true],
      ["c", true],
      ["d", false],
    ]);
  });

  it("marks definitions with errors broken, without stopping calls from checking", () => {
    const { diagnostics, definitions } = compile('<Define name="f" formula="nope" /><Value formula="f()" />');
    expect(diagnostics.map((item) => item.code)).toEqual(["unknown-field"]);
    expect(definitions.get("f")).toMatchObject({ broken: true, ast: undefined });
  });
});

describe("newSheetErrors", () => {
  it("lists errors a schema change adds", () => {
    const markup = '<Define name="ac" formula="10 + stats.str" /><Value formula="ac()" /><Number field="hp" />';
    const changed: SheetSchemas = {
      ...schemas,
      root: {
        ...character,
        schema: { ...character.schema, stats: { type: "struct", entries: { str: { type: "string" } } } },
      },
    };
    expect(newSheetErrors(markup, schemas, schemas)).toEqual([]);
    expect(newSheetErrors(markup, schemas, changed).map((item) => item.message)).toEqual([
      "+ needs numbers (use concat to join text), not text",
    ]);
  });
});

describe("show", () => {
  it("takes a bare formula, on every tag but Column", () => {
    expect(messages('<Section show="hp > 0"><Note show="alive">x</Note></Section>')).toEqual([]);
    expect(messages('<Tabs><Tab label="A" show="hp > 1">a</Tab></Tabs>')).toEqual([]);
    expect(messages('<Table field="attacks"><Column field="name" /><RowDetails show="bonus > 0">x</RowDetails></Table>')).toEqual([]);
    expect(messages('<Value field="hp" show=" hp > 1 " />')).toEqual([]);
    expect(messages('<Table field="attacks"><Column field="name" show="true" /></Table>')).toEqual([
      "error unknown-attribute: <Column> has no show attribute; use show on the Table, or a formula in the column",
    ]);
  });

  it("rejects braces and an empty formula", () => {
    expect(messages('<Note show="{alive}">x</Note>')).toEqual([
      'error formula-syntax: Unexpected "{"; inside a formula, refer to fields by name, like level, without braces',
    ]);
    expect(messages('<Note show="">x</Note>')).toEqual([
      'error invalid-attribute: show needs a formula, like show="level >= 5"',
    ]);
  });

  it("needs true, false, or nothing", () => {
    expect(messages('<Note show="hp">x</Note>')).toEqual([
      "error formula-result-type: show must give true or false, but hp gives a number",
    ]);
    expect(messages('<Note show="notes">x</Note>')[0]).toMatch(
      /^error formula-result-type: show must give true or false, but notes gives text/,
    );
    expect(messages('<Note show="extra">x</Note>')).toEqual([]);
  });

  it("evaluates in the tag's scope and still validates hidden content", () => {
    expect(messages('<List field="attacks"><Note show="bonus > 0">{name}</Note></List>')).toEqual([]);
    expect(errorCodes('<Section show="false"><Number field="nope" /></Section>')).toEqual(["unknown-field"]);
  });
});

describe("the Pathfinder 2e example", () => {
  it("compiles with no diagnostics", () => {
    const { diagnostics, definitions } = compileSheet(pathfinder2eMarkup, pathfinder2eSchemas);
    expect(diagnostics).toEqual([]);
    expect([...definitions.keys()]).toEqual(["prof", "check", "classDc"]);
  });
});

describe("formula types from the schema", () => {
  const loose: SheetSchemas = { root: { ...character, hasStrictSchema: false, showSheetWarnings: true }, types: schemas.types };

  it.each([
    ["hp + 1", []],
    ["notes + 1", ["formula-type"]],
    ["alive + 1", ["formula-type"]],
    ["stats + 1", ["formula-type"]],
    ["tags + 1", ["formula-type"]],
    // scalar, free-form, and content values could be anything that fits.
    ["extra + 1", []],
    ["misc.deep.value + 1", []],
    ["class == 'x'", []],
    ["inventory.0.item == 'x'", []],
    ["link == 'x'", []],
    ["inventory.0.item.weight + 1", []],
    ["inventory.0.item.cost + 1", ["formula-type"]],
  ])("strict: %s", (source, codes) => {
    expect(errorCodes(`<Value formula="${source}" />`)).toEqual(codes);
  });

  it("treats paths a non-strict schema doesn't know as anything, with a warning", () => {
    expect(messages('<Value formula="unknown + 1" />', loose)).toEqual([
      'warning unknown-field: "unknown": the schema has no field "unknown"; it will show whatever the data holds',
    ]);
    expect(errorCodes('<Value formula="notes + 1" />', loose)).toEqual(["formula-type"]);
  });

  it("only warns about free-form object paths when the content type asks for it", () => {
    expect(messages('<Value formula="misc.a + 1" />')).toEqual([
      'warning free-form-path: "misc.a": "misc" is a free-form object, so "a" isn\'t checked; it will show whatever the data holds',
    ]);
    const quiet: SheetSchemas = { ...schemas, root: { ...character, showSheetWarnings: false } };
    expect(messages('<Value formula="misc.a + 1" />', quiet)).toEqual([]);
  });
});

describe("dynamic number attributes", () => {
  it("take {…} only where they're computed when rendering", () => {
    expect(messages('<Heading level="{2}">Hi</Heading>')).toEqual([
      "error invalid-attribute: level on <Heading> must be a plain number, not {…}",
    ]);
    expect(errorCodes('<Grid cols="{hp}">x</Grid>')).toEqual(["invalid-attribute"]);
    expect(errorCodes('<Section span="{2}">x</Section>')).toEqual(["invalid-attribute"]);
    expect(messages('<Number field="hp" min="{0}" max="{hpMax}" step="{1}" />')).toEqual([]);
    expect(messages('<Tracker field="hp" max="{hpMax}" />')).toEqual([]);
  });
});

describe("review follow-ups", () => {
  it("checks the bodies of definitions that can't be used", () => {
    expect(errorCodes('<Define name="a" formula="1" /><Define name="a" formula="1 +* 2" />')).toEqual([
      "duplicate-definition",
      "formula-syntax",
    ]);
    expect(errorCodes('<Define name="floor" formula="(" />')).toEqual(["formula-reserved-name", "formula-syntax"]);
  });

  it("rejects dice-like definition and parameter names", () => {
    expect(messages('<Define name="d6" formula="1" />')).toEqual([
      "error formula-reserved-name: d6 looks like dice (2d6); choose another name",
    ]);
    expect(errorCodes('<Define name="f" params="d20" formula="1" />')).toEqual(["invalid-attribute"]);
  });

  it("warns about overrides bound to required fields", () => {
    const required: SheetSchemas = {
      ...schemas,
      root: { ...character, schema: { ...character.schema, ac: { type: "number", required: true } } },
    };
    expect(messages('<Number field="ac" formula="10" />', required)).toEqual([
      'warning override-required: "ac" is required, so going back to the computed value (which clears it) can\'t be saved; make the field optional',
    ]);
    expect(messages('<Number field="hp" formula="10" />', required)).toEqual([]);
  });

  it("registers top-level override fields as computed fields", () => {
    const { computedFields } = compile(
      '<Number field="hpMax" formula="10 + stats.str" /><Value field="hp" formula="1" />' +
        '<Table field="attacks"><Number field="bonus" formula="2" /></Table>',
    );
    expect([...computedFields.keys()]).toEqual(["hpMax"]);
    expect(computedFields.get("hpMax")).toMatchObject({ tag: "Number", source: "10 + stats.str" });
  });

  it("allows the same formula on a field twice, but not two different ones", () => {
    expect(messages('<Number field="hp" formula="hpMax" /><Number field="hp" formula=" hpMax " />')).toEqual([]);
    expect(messages('<Number field="hp" formula="hpMax+1" /><Number field="hp" formula="(hpMax) + 1" />')).toEqual([]);
    expect(messages('<Number field="hp" formula="hpMax" />\n<Number field="hp" formula="hpMax + 1" />')).toEqual([
      'error computed-field-conflict: "hp" already has a different formula on line 1; give a field one formula',
    ]);
  });

  it("explains a quote that cuts a {} attribute short", () => {
    expect(messages('<Section title="{concat("a", hp)}">x</Section>')).toContain(
      "error formula-syntax: The formula ends at this \"; inside title=\"…\", write text in single quotes, like 'expert'",
    );
  });
});

describe("choice fields", () => {
  const ranks = [{ value: 0, label: "Untrained" }, { value: 2, label: "Expert" }];
  const choiceSchemas: SheetSchemas = {
    root: {
      hasStrictSchema: true,
      schema: {
        size: { type: "string", options: [{ value: "s", label: "Small" }, { value: "m" }] },
        rank: { type: "number", options: ranks },
        level: { type: "number" },
        notes: { type: "string" },
        traits: { type: "array", itemType: { type: "string", options: [{ value: "brave" }] } },
        lores: {
          type: "array",
          itemType: { type: "struct", entries: { name: { type: "string" }, rank: { type: "number", options: ranks } } },
        },
      },
    },
    types: {},
  };
  const choiceErrors = (markup: string) => errorCodes(markup, choiceSchemas);
  const choiceMessages = (markup: string) => messages(markup, choiceSchemas);

  it("takes a Select's options from the schema, also on number fields", () => {
    expect(
      choiceMessages(`
        <Select field="size" />
        <Select field="rank" />
        <Field field="rank" />
        <Field field="traits" />
        <Value field="rank" />
        <Table field="lores"><Column field="name" /><Column field="rank" /></Table>
        <Value formula="rank * 2" />
        <Number formula="rank + level" />
      `),
    ).toEqual([]);
  });

  it("ignores a Select's own list on a field with options, with a warning", () => {
    expect(choiceMessages(`<Select field="size" options="a, b" />`)).toEqual([
      'warning options-ignored: "size" has options in the schema, so this options list is ignored; remove it',
    ]);
  });

  it("keeps a Select's own list on a text field without options, and needs one there", () => {
    expect(choiceMessages(`<Select field="notes" options="a, b" />`)).toEqual([]);
    expect(choiceMessages(`<Select field="notes" />`)).toEqual([
      'error missing-attribute: <Select> needs an options attribute: "notes" has no options in the schema',
    ]);
    expect(choiceErrors(`<Select field="level" options="1, 2" />`)).toEqual(["wrong-field-type"]);
  });

  it("rejects free inputs on fields with options", () => {
    for (const markup of [
      `<Text field="size" />`,
      `<Number field="rank" />`,
      `<Number field="rank" formula="2" />`,
      `<Tracker field="rank" max="4" />`,
      `<Markdown field="size" />`,
      `<Image field="size" />`,
      `<Tags field="traits" />`,
    ]) {
      expect(choiceErrors(markup), markup).toEqual(["wrong-field-type"]);
    }
    expect(choiceMessages(`<Text field="size" />`)).toEqual([
      'error wrong-field-type: <Text> can\'t show "size": it has options; use <Select> or <Field>',
    ]);
    expect(choiceErrors(`<Field field="rank" formula="2" />`)).toEqual(["invalid-attribute"]);
  });

  it("marks {path} text that shows a choice field's label", () => {
    const { nodes } = compileSheet(`<Note>{size} {rank} {rank + 1} {level}</Note>`, choiceSchemas);
    const parts = (first(nodes).children[0] as { parts: unknown[] }).parts;
    const options = parts.map((part) => (typeof part === "object" ? (part as { options?: unknown }).options : null));
    expect(options).toEqual([
      choiceSchemas.root.schema.size!.type === "string" && choiceSchemas.root.schema.size!.options,
      null,
      ranks,
      null,
      undefined,
      null,
      undefined,
    ]);
  });
});

describe("repeating over a struct's entries", () => {
  const rank = { type: "struct" as const, entries: { rank: { type: "number" as const } } };
  const structSchemas: SheetSchemas = {
    root: {
      hasStrictSchema: true,
      schema: {
        skills: {
          type: "struct",
          entries: { acrobatics: rank, arcana: { ...rank, label: "Arcana Lore" } },
        },
        attributes: {
          type: "struct",
          entries: { str: { type: "number", label: "Str" }, dex: { type: "number", required: true } },
        },
        mixed: { type: "struct", entries: { a: { type: "number" }, b: { type: "string" } } },
        attacks: { type: "array", itemType: { type: "struct", entries: { bonus: { type: "number" } } } },
      },
    },
    types: {},
  };
  const structMessages = (markup: string) => messages(markup, structSchemas);
  const structErrors = (markup: string) => errorCodes(markup, structSchemas);

  it("binds Table and List to structs of alike entries, listing the entries", () => {
    const { nodes, diagnostics } = compile(
      `<Table field="skills">
        <Column formula="itemLabel()" label="Skill" />
        <Column field="rank" />
        <Column formula="concat(itemKey(), ': ', text(rank))" />
      </Table>
      <List field="attributes"><Number field="." /></List>`,
      structSchemas,
    );
    expect(diagnostics).toEqual([]);
    const [table, list] = nodes.filter((node): node is ValidatedElement => node.type === "element");
    expect(table!.entries).toEqual([
      { key: "acrobatics", label: "Acrobatics" },
      { key: "arcana", label: "Arcana Lore" },
    ]);
    expect(list!.entries).toEqual([
      { key: "str", label: "Str" },
      { key: "dex", label: "Dex" },
    ]);
    // `.` takes each row's label when rendered, not the first entry's.
    expect((list!.children[0] as ValidatedElement).binding?.label).toBe("");
  });

  it("explains structs that can't be repeated over", () => {
    expect(structMessages(`<Table field="attributes"><Column field="." /></Table>`)).toEqual([
      'error wrong-field-type: <Table> can\'t show "attributes": its entries aren\'t structs; use <List>',
    ]);
    expect(structMessages(`<List field="mixed"><Value field="." /></List>`)).toEqual([
      'error wrong-field-type: <List> can\'t repeat over "mixed": a struct\'s entries must all be alike (the same type and fields) and each a struct or a single value',
    ]);
    expect(structMessages(`<Field field="skills" />`)).toEqual([
      'error wrong-field-type: <Field> can\'t show "skills": it\'s a struct; use a <Section> with fields inside, or a <List> or <Table> over its entries',
    ]);
  });

  it("warns that addLabel does nothing on a struct List", () => {
    expect(structMessages(`<List field="attributes" addLabel="Add"><Value field="." /></List>`)).toEqual([
      "warning flag-no-effect: addLabel has no effect on a <List> of a struct's entries: its rows come from the schema",
    ]);
  });

  it("types itemKey() and itemLabel() by the row, and rejects them outside one", () => {
    // In a struct row the key is text; in an array row, a number.
    expect(structErrors(`<Table field="skills"><Column formula="itemKey() + 1" /></Table>`)).toEqual(["formula-type"]);
    expect(structErrors(`<Table field="attacks"><Column formula="itemKey() + 1" /></Table>`)).toEqual([]);
    expect(structErrors(`<Value formula="sum(attacks, bonus + itemKey())" />`)).toEqual([]);
    expect(structMessages(`<Value formula="itemKey()" />`)).toEqual([
      "error formula-no-item: itemKey() works only in a List or Table row, or inside sum, count, any, or all",
    ]);
    expect(structErrors(`<Table field="skills"><Column field="rank" /></Table><Define name="k" formula="itemLabel()" /><Value formula="k()" />`)).toContain("formula-no-item");
  });

  it("lets per-item functions repeat over a struct's entries", () => {
    const { nodes, diagnostics } = compile(
      `<Value formula="count(skills, rank > 0)" /><Value formula="sum(attributes)" /><Value formula="sum(skills, length(itemLabel()))" />`,
      structSchemas,
    );
    expect(diagnostics).toEqual([]);
    const first = nodes[0] as ValidatedElement;
    const call = first.formula!.ast as Extract<FormulaNode, { type: "call" }>;
    expect(call.args[0]).toMatchObject({ type: "path", entries: [{ key: "acrobatics" }, { key: "arcana" }] });
    expect(structErrors(`<Value formula="sum(mixed)" />`)).toEqual(["formula-type"]);
  });

  it("lets a definition named like the new functions keep working, with a warning", () => {
    expect(structMessages(`<Define name="itemKey" formula="1" /><Value formula="itemKey()" />`)).toEqual([
      expect.stringMatching(/^warning formula-shadows-builtin/),
    ]);
  });
});
