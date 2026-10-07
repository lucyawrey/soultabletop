import { describe, expect, it } from "vitest";
import { sheetButtonWrites, sheetValueAt, setSheetValue, type SheetScope } from "./runtime";
import type { SheetSchemas, ValidatedElement, ValidatedNode } from "./validate";
import { compileInSheet as compileSheet } from "./fixtures/in-sheet";

// <Button> and <Set>: sheet buttons that change fields.

const schemas: SheetSchemas = {
  root: {
    hasStrictSchema: true,
    showSheetWarnings: true,
    schema: {
      hp: {
        type: "struct",
        entries: { value: { type: "number" }, temp: { type: "number" }, max: { type: "number" } },
      },
      focus: { type: "number" },
      level: { type: "number", required: true },
      flag: { type: "boolean" },
      notes: { type: "string" },
      tags: { type: "array", itemType: { type: "string" } },
      spells: {
        type: "array",
        itemType: {
          type: "struct",
          entries: { name: { type: "string" }, cast: { type: "boolean" }, uses: { type: "number" }, max: { type: "number" } },
        },
      },
      slots: {
        type: "struct",
        entries: {
          r1: { type: "struct", entries: { used: { type: "number" } } },
          r2: { type: "struct", entries: { used: { type: "number" } } },
        },
      },
      inventory: {
        type: "array",
        itemType: {
          type: "struct",
          entries: {
            name: { type: "string" },
            state: { type: "string", options: [{ value: "Held" }, { value: "Worn" }, { value: "Stowed" }] },
          },
        },
      },
      class: { type: "content", contentTypeId: "cls", allow: "reference" },
    },
  },
  types: { cls: { hasStrictSchema: true, schema: { hp: { type: "number" } } } },
};

const messages = (markup: string) =>
  compileSheet(markup, schemas).diagnostics.map((item) => `${item.severity} ${item.code}: ${item.message}`);

const elements = (nodes: ValidatedNode[]) =>
  nodes.filter((node): node is ValidatedElement => node.type === "element");

// The Buttons of a sheet, depth first.
function buttons(markup: string): ValidatedElement[] {
  const compiled = compileSheet(markup, schemas);
  expect(compiled.diagnostics).toEqual([]);
  const found: ValidatedElement[] = [];
  const visit = (nodes: ValidatedNode[]) => {
    for (const node of elements(nodes)) {
      if (node.tag === "Button") found.push(node);
      else visit(node.children);
    }
  };
  visit(compiled.nodes);
  return found;
}

// Clicks a Button against `data` (in place), returning the writes.
function click(button: ValidatedElement, data: Record<string, unknown>, amount?: number | null, scope?: SheetScope) {
  const root: SheetScope = { value: data, path: [] };
  const result = sheetButtonWrites(button, root, scope ?? root, {}, undefined, amount);
  if ("writes" in result) for (const write of result.writes) setSheetValue(data, write.path, write.value);
  return result;
}

describe("Button and Set validation", () => {
  it("accepts the PF2e sheet's buttons", () => {
    expect(
      messages(`
        <Button label="Heal" amount live>
          <Set field="hp.value" formula="min(hp.value + amount, hp.max)" />
        </Button>
        <Button label="Damage" amount live>
          <Set field="hp.temp" formula="max(0, hp.temp - amount)" />
          <Set field="hp.value" formula="max(0, hp.value - max(0, amount - hp.temp))" />
        </Button>
        <Button label="Daily preparations" icon="i-lucide-sunrise">
          <Set field="spells.*.cast" formula="false" />
          <Set field="spells.*.uses" formula="max" />
          <Set field="slots.*.used" formula="0" />
          <Set field="focus" formula="null" />
        </Button>
        <Table field="inventory">
          <Column field="name" />
          <Column label="Move">
            <Button label="Wear" show="state == 'Held'"><Set field="state" formula="'Worn'" /></Button>
          </Column>
        </Table>`),
    ).toEqual([]);
  });

  it("knows amount only on a Button with amount", () => {
    expect(messages(`<Button label="Heal"><Set field="focus" formula="amount" /></Button>`)).toEqual([
      'error unknown-field: "amount": the schema has no field "amount"',
    ]);
  });

  it("checks the field and the formula's result", () => {
    expect(messages(`<Button label="X"><Set field="hp" formula="1" /></Button>`)).toEqual([
      'error wrong-field-type: <Set> can\'t change "hp": it\'s a struct; a Set changes one text, number, or true/false value',
    ]);
    expect(messages(`<Button label="X"><Set field="tags" formula="'a'" /></Button>`)).toEqual([
      'error wrong-field-type: <Set> can\'t change "tags": it\'s an array; a Set changes one text, number, or true/false value',
    ]);
    expect(messages(`<Button label="X"><Set field="focus" formula="'a'" /></Button>`)).toEqual([
      'error formula-result-type: The formula gives text, but "focus" holds a number',
    ]);
    expect(messages(`<Button label="X"><Set field="nope" formula="1" /></Button>`)).toEqual([
      'error unknown-field: "nope": the schema has no field "nope"',
    ]);
    expect(
      messages(`<List field="inventory"><Button label="X"><Set field="state" formula="'Lost'" /></Button></List>`),
    ).toEqual(['error formula-result-type: "Lost" isn\'t one of the options of "state"']);
  });

  it("checks * paths", () => {
    expect(messages(`<Button label="X"><Set field="focus.*" formula="1" /></Button>`)).toEqual([
      'error wrong-field-type: "focus.*": "focus" is a number field; * needs a list, or a struct whose entries are alike',
    ]);
    expect(messages(`<Button label="X"><Set field="spells.*.*.cast" formula="true" /></Button>`)).toEqual([
      'error invalid-attribute: "spells.*.*.cast" has more than one *; a Set changes the items of one list',
    ]);
    expect(messages(`<Button label="X"><Set field="*.cast" formula="true" /></Button>`)).toEqual([
      'error invalid-attribute: "*.cast" isn\'t a valid field path; * stands for every item of a list, like spells.*.cast',
    ]);
    expect(messages(`<Button label="X"><Set field="spells.*.nope" formula="true" /></Button>`)).toEqual([
      'error unknown-field: "spells.*.nope": "spells.*" has no field "nope"',
    ]);
  });

  it("warns that a Set through a content field changes only local data", () => {
    expect(messages(`<Button label="X"><Set field="class.hp" formula="1" /></Button>`)).toEqual([
      'warning set-through-content: "class.hp" goes through a content field: the Set changes it only where that content is stored in this one (local data), never referenced content',
    ]);
  });

  it("accepts arrays of single values, indexes, and top-level paths in a * Set", () => {
    expect(
      messages(`<Button label="X">
        <Set field="tags.*" formula="'x'" />
        <Set field="spells.0.cast" formula="true" />
        <Set field="spells.*.uses" formula="/focus" />
      </Button>`),
    ).toEqual([]);
  });

  it("places Buttons and Sets (a Column may show a field beside its Buttons)", () => {
    expect(messages(`<Button label="X" />`)).toEqual([
      "error missing-child: <Button> needs a step: a <Set> for each field it changes, or a <Roll>",
    ]);
    expect(messages(`<Set field="focus" formula="1" />`)).toEqual([
      "error step-misplaced: <Set> must be directly inside <Button> or <Value> or <Number> or <Column> or <FollowUp>",
    ]);
    expect(messages(`<Button label="X"><Number field="focus" /></Button>`)).toEqual([
      "error child-not-allowed: <Button> can only contain <Set> and <Roll> and <FollowUp>",
    ]);
    expect(messages(`<Button label="X" locked><Set field="focus" formula="1" /></Button>`)[0]).toContain(
      "error unknown-attribute: <Button> has no locked attribute",
    );
    expect(
      messages(`<Table field="inventory"><Column field="name"><Button label="X"><Set field="name" formula="'a'" /></Button></Column></Table>`),
    ).toEqual([]);
  });
});

describe("clicking a Button", () => {
  const [heal, damage, prep, wear] = buttons(`
    <Button label="Heal" amount>
      <Set field="hp.value" formula="min(hp.value + amount, hp.max)" />
    </Button>
    <Button label="Damage" amount>
      <Set field="hp.value" formula="max(0, hp.value - max(0, amount - hp.temp))" />
      <Set field="hp.temp" formula="max(0, hp.temp - amount)" />
    </Button>
    <Button label="Daily preparations">
      <Set field="spells.*.cast" formula="false" />
      <Set field="spells.*.uses" formula="max" />
      <Set field="slots.*.used" formula="0" />
      <Set field="focus" formula="null" />
    </Button>
    <List field="inventory">
      <Button label="Wear"><Set field="state" formula="'Worn'" /></Button>
    </List>`);

  it("runs Sets in order, each reading what the ones before it wrote", () => {
    const data = { hp: { value: 20, temp: 3, max: 30 } };
    click(damage!, data, 5);
    expect(data.hp).toEqual({ value: 18, temp: 0, max: 30 });
    click(heal!, data, 50);
    expect(data.hp.value).toBe(30);
    const [twice] = buttons(`<Button label="Twice"><Set field="focus" formula="focus + 1" /><Set field="focus" formula="focus * 10" /></Button>`);
    const counter: Record<string, unknown> = { focus: 1 };
    click(twice!, counter);
    expect(counter.focus).toBe(20);
  });

  it("gives back the previous values for Undo", () => {
    const data: Record<string, unknown> = { hp: { value: 20, temp: 3, max: 30 } };
    const result = click(damage!, data, 1);
    expect(result).toEqual({
      writes: [
        { path: ["hp", "value"], value: 20, previous: 20 },
        { path: ["hp", "temp"], value: 2, previous: 3 },
      ],
    });
  });

  it("writes every item for *, in each item's scope, and removes a key for nothing", () => {
    const data: Record<string, unknown> = {
      spells: [
        { name: "Bless", cast: true, uses: 0, max: 2 },
        { name: "Command", cast: false, max: 1 },
      ],
      slots: { r1: { used: 2 } },
      focus: 1,
    };
    const result = click(prep!, data);
    expect(data).toEqual({
      spells: [
        { name: "Bless", cast: false, uses: 2, max: 2 },
        { name: "Command", cast: false, uses: 1, max: 1 },
      ],
      // Struct entries come from the schema, so r2 is written too.
      slots: { r1: { used: 0 }, r2: { used: 0 } },
    });
    expect("writes" in result && result.writes.at(-1)).toEqual({ path: ["focus"], value: undefined, previous: 1 });
  });

  it("writes in the Button's row", () => {
    const data = { inventory: [{ name: "Mace", state: "Held" }, { name: "Sling", state: "Held" }] };
    const row: SheetScope = { value: data.inventory[1], path: ["inventory", 1] };
    click(wear!, data, undefined, row);
    expect(data.inventory.map((item) => item.state)).toEqual(["Held", "Worn"]);
  });

  it("writes nothing when a formula fails", () => {
    const data = { hp: { value: 20, temp: "x", max: 30 } };
    expect(click(damage!, data, 5)).toEqual({ error: expect.stringContaining("number") });
    expect(data.hp).toEqual({ value: 20, temp: "x", max: 30 });
  });

  it("writes nothing when a result doesn't fit its field", () => {
    const [mixed, lost, cleared] = buttons(`
      <Button label="Mixed"><Set field="focus" formula="if(flag, 1, 'a')" /></Button>
      <List field="inventory">
        <Button label="Lose"><Set field="state" formula="if(/flag, 'Held', 'Lost')" /></Button>
      </List>
      <Button label="Clear"><Set field="level" formula="null" /></Button>`);
    const data = { flag: false, focus: 2, level: 3, inventory: [{ name: "Mace", state: "Held" }] };
    expect(click(mixed!, data)).toEqual({ error: '"focus" holds a number, but the formula gave "a"' });
    const row: SheetScope = { value: data.inventory[0], path: ["inventory", 0] };
    expect(click(lost!, data, undefined, row)).toEqual({ error: '"Lost" isn\'t one of the options of "state"' });
    expect(click(cleared!, data)).toEqual({ error: '"level" is required, so it can\'t be left empty' });
    expect(data).toEqual({ flag: false, focus: 2, level: 3, inventory: [{ name: "Mace", state: "Held" }] });
  });

  it("reads values by path for Undo", () => {
    const data = { spells: [{ cast: true }], hp: { value: 3 } };
    expect(sheetValueAt(data, ["spells", 0, "cast"])).toBe(true);
    expect(sheetValueAt(data, ["hp", "temp"])).toBeUndefined();
    expect(sheetValueAt(data, ["hp", "value", "x"])).toBeUndefined();
    expect(sheetValueAt(data, ["constructor"])).toBeUndefined();
  });

  it("needs an amount typed in", () => {
    const data = { hp: { value: 20, temp: 0, max: 30 } };
    expect(click(heal!, data, null)).toEqual({ error: "Type an amount first" });
    expect(data.hp.value).toBe(20);
  });
});
