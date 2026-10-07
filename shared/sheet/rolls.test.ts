import { describe, expect, it } from "vitest";
import { parseFormula, printFormula } from "./formula";
import { runSheetAction, sheetActionSteps, type SheetActionContext, type SheetScope } from "./runtime";
import { printRollTerm, rollTermDice } from "./roll";
import type { SheetSchemas, ValidatedElement, ValidatedNode } from "./validate";
import { compileInSheet as compileSheet } from "./fixtures/in-sheet";

// <Roll> and <FollowUp>: actions that roll dice, end to end (compile, then run).

const schemas: SheetSchemas = {
  root: {
    hasStrictSchema: true,
    showSheetWarnings: true,
    schema: {
      dex: { type: "number" },
      fortune: { type: "boolean" },
      heroPoints: { type: "number" },
      damage: { type: "string" },
      critRange: { type: "number" },
      strikes: {
        type: "array",
        itemType: {
          type: "struct",
          entries: { name: { type: "string" }, bonus: { type: "number" }, damage: { type: "string" } },
        },
      },
    },
  },
  types: {},
};

const messages = (markup: string) =>
  compileSheet(markup, schemas).diagnostics.map((item) => `${item.severity} ${item.code}: ${item.message}`);

// The first tag named `tag` (depth first), from markup that compiles cleanly.
function find(markup: string, tag: string): ValidatedElement {
  const compiled = compileSheet(markup, schemas);
  expect(compiled.diagnostics).toEqual([]);
  let found: ValidatedElement | undefined;
  const visit = (nodes: ValidatedNode[]) => {
    for (const node of nodes) {
      if (node.type !== "element" || found) continue;
      if (node.tag === tag) found = node;
      else visit(node.children);
    }
  };
  visit(compiled.nodes);
  return found!;
}

// Dice that land on these faces, in order (then 1s).
function faces(...list: number[]) {
  let index = 0;
  return () => list[index++] ?? 1;
}

function run(action: ValidatedElement, data: Record<string, unknown>, options: Partial<SheetActionContext> = {}) {
  const root: SheetScope = { value: data, path: [] };
  return runSheetAction(action.children, { root, scope: root, refs: {}, random: faces(), title: "Test", ...options });
}

describe("dice in formulas", () => {
  it("parses keep highest and lowest", () => {
    const at = { line: 1, column: 1, offset: 0 };
    expect(printFormula(parseFormula("2d20kh1 + 4d6kl3 + d20kh1", at).ast!)).toBe("((2d20kh1 + 4d6kl3) + 1d20kh1)");
    expect(parseFormula("2d6kx", at).diagnostics[0]?.message).toBe("\"2d6kx\" looks like dice but isn't; dice look like 2d6 or 2d20kh1");
  });

  it("allows dice only in a Roll's formula, in arithmetic and if branches", () => {
    expect(messages(`<Value formula="d20" />`)).toEqual([
      "error dice-outside-roll: Dice can only be rolled in a <Roll>'s formula",
    ]);
    expect(messages(`<Value formula="dex"><Roll formula="max(d6, d6)" /></Value>`)).toEqual([
      "error dice-outside-roll: Dice can only be added, subtracted, multiplied, or divided, or picked with if()",
      "error dice-outside-roll: Dice can only be added, subtracted, multiplied, or divided, or picked with if()",
    ]);
    expect(messages(`<Value formula="dex"><Roll formula="if(fortune, 2d20kh1, d20) + value() - 2 * d4 / 2" /></Value>`)).toEqual([]);
    expect(messages(`<Value formula="dex"><Roll formula="if(d20 > 10, 1, 2)" /></Value>`)).toEqual([
      "error dice-outside-roll: Dice can only be added, subtracted, multiplied, or divided, or picked with if()",
    ]);
  });

  it("checks dice(text), value(), and the limits", () => {
    expect(messages(`<Button label="Hit"><Roll formula="dice(damage) + dice(dex)" /></Button>`)).toEqual([
      "error formula-type: dice needs text, like '2d6 + 3', not a number",
    ]);
    expect(messages(`<Button label="Hit"><Roll formula="d20 + value()" /></Button>`)).toEqual([
      "error value-outside-value: value() works only in a step (Roll, Set, FollowUp) inside a <Value>, <Number>, or <Column>",
    ]);
    expect(messages(`<Value formula="value()" />`)).toEqual([
      "error value-outside-value: value() works only in a step (Roll, Set, FollowUp) inside a <Value>, <Number>, or <Column>",
    ]);
    expect(messages(`<Button label="X"><Roll formula="101d6" /></Button>`)).toEqual([
      "error roll-limit: A roll can have at most 100 dice",
    ]);
    expect(messages(`<Button label="X"><Roll formula="d1 + 2d6kh3" /></Button>`)).toEqual([
      "error roll-limit: Dice have 2 to 1000 sides, not 1",
      "error roll-limit: Can't keep 3 of 2 dice",
    ]);
  });
});

describe("Roll and FollowUp validation", () => {
  it("names rolls for later steps, and reports misuse", () => {
    expect(
      messages(`<Value formula="dex">
        <Roll name="hit" formula="d20 + value()" crit="face == 20" fumble="face == 1" />
        <FollowUp label="Damage ({hit.total})" show="hit.crit or hit.natural >= critRange">
          <Roll formula="dice(damage)" />
        </FollowUp>
      </Value>`),
    ).toEqual([]);
    expect(messages(`<Value formula="dex"><Roll name="hit" formula="d20" /><Set field="dex" formula="hit + 1" /></Value>`)).toEqual([
      "error roll-record-as-number: + needs a number, but hit is a roll; use hit.total for its result",
    ]);
    expect(messages(`<Value formula="dex"><Roll name="hit" formula="d20" /><Roll name="hit" formula="hit.bonus" /></Value>`)).toEqual([
      "error roll-name-duplicate: Another <Roll> in this action is named hit",
      "error formula-type: hit is a roll; it has total, dice, natural, crit, and fumble, not bonus",
    ]);
    expect(messages(`<Value formula="dex"><Roll name="d6" formula="d20" crit="face" /></Value>`)).toEqual([
      "error invalid-attribute: \"d6\" can't name a roll; choose another name",
      "error formula-result-type: crit on <Roll> must give true or false, but face gives a number",
    ]);
  });

  it("places steps and follow-ups", () => {
    expect(messages(`<Value formula="dex"><FollowUp label="X"><Roll formula="d6" /></FollowUp></Value>`)).toEqual([
      "error follow-up-without-roll: A <FollowUp> is offered on the entry of the <Roll> before it; put a <Roll> first",
    ]);
    expect(messages(`<Value formula="dex"><Roll formula="d20" /><FollowUp label="X" /></Value>`)).toEqual([
      "error follow-up-empty: <FollowUp> needs a step: a <Roll> or a <Set>",
    ]);
    expect(messages(`<Section><Roll formula="d6" /></Section>`)).toEqual([
      "error step-misplaced: <Roll> must be directly inside <Button> or <Value> or <Number> or <Column> or <FollowUp>",
    ]);
    expect(messages(`<Value><Roll formula="d6" /></Value>`)).toEqual([
      "error missing-attribute: <Value> with steps needs a field, formula, or parts: clicking its value runs them",
    ]);
    const deep = `<Roll formula="d6" /><FollowUp label="1"><Roll formula="d6" /><FollowUp label="2"><Roll formula="d6" /><FollowUp label="3"><Roll formula="d6" /><FollowUp label="4"><Roll formula="d6" /></FollowUp></FollowUp></FollowUp></FollowUp>`;
    expect(messages(`<Button label="Deep">${deep}</Button>`)).toEqual([
      "error roll-limit: Follow-ups can be nested at most 3 deep",
    ]);
  });
});

describe("running an action", () => {
  it("rolls, marks critical and fumble dice, and keeps the expression as rolled", () => {
    const value = find(
      `<Value formula="dex + 3"><Roll name="hit" label="Attack" formula="if(fortune, 2d20kh1, d20) + value()" crit="face == 20" fumble="face == 1" /></Value>`,
      "Value",
    );
    expect(sheetActionSteps(value)).toBe(true);
    const plain = run(value, { dex: 4, fortune: false }, { shown: 7, random: faces(20) });
    expect(plain).toMatchObject({
      writes: [],
      entries: [{ title: "Test", label: "Attack", expression: "d20 + 7", total: 27, natural: 20, naturalMark: "crit", name: "hit" }],
    });
    const fortune = run(value, { dex: 4, fortune: true }, { shown: 7, random: faces(1, 12) });
    if (!("entries" in fortune)) throw new Error(fortune.error);
    const [entry] = fortune.entries;
    expect(entry!.expression).toBe("2d20kh1 + 7");
    expect(rollTermDice(entry!.term)).toEqual([
      { sides: 20, face: 1, kept: false },
      { sides: 20, face: 12, kept: true },
    ]);
    expect(entry!.records.hit).toEqual({ total: 19, dice: [12], natural: 12, crit: false, fumble: false });
  });

  it("offers follow-ups with the rolls before them, and runs them later", () => {
    const value = find(
      `<Value formula="dex">
        <Roll name="hit" formula="d20 + value()" crit="face == 20" />
        <FollowUp label="Damage"><Roll formula="dice(damage)" /></FollowUp>
        <FollowUp label="Critical" show="hit.crit"><Roll formula="2 * dice(damage) + d8" /></FollowUp>
      </Value>`,
      "Value",
    );
    const data = { dex: 4, damage: "1d6 + 4" };
    const result = run(value, data, { shown: 4, random: faces(15) });
    if (!("entries" in result)) throw new Error(result.error);
    const [attack] = result.entries;
    expect(attack!.followUps.map((followUp) => followUp.node.attrs.label)).toEqual([["Damage"], ["Critical"]]);
    const critical = attack!.followUps[1]!;
    const later = runSheetAction(critical.node.children, {
      root: { value: data, path: [] },
      scope: { value: data, path: [] },
      refs: {},
      params: critical.params,
      random: faces(3, 5),
      title: "Test",
    });
    if (!("entries" in later)) throw new Error(later.error);
    expect(later.entries[0]).toMatchObject({ expression: "2 × (d6 + 4) + d8", total: 19 });
    expect(later.entries[0]!.records.hit!.total).toBe(19);
  });

  it("runs Sets and Rolls in order, each seeing the ones before", () => {
    const button = find(
      `<Button label="Reroll">
        <Set field="heroPoints" formula="heroPoints - 1" />
        <Roll name="check" formula="d20 + heroPoints" />
        <Set field="dex" formula="check.total" />
      </Button>`,
      "Button",
    );
    const result = run(button, { heroPoints: 2, dex: 0 }, { random: faces(10) });
    expect(result).toMatchObject({
      writes: [
        { path: ["heroPoints"], value: 1, previous: 2 },
        { path: ["dex"], value: 11, previous: 0 },
      ],
      entries: [{ expression: "d20 + 1", total: 11 }],
    });
  });

  it("rolls in a Table row with its own fields", () => {
    const column = find(
      `<Table field="strikes"><Column field="name" /><Column label="Hit" formula="bonus"><Roll formula="d20 + value()" /><FollowUp label="Damage"><Roll formula="dice(damage)" /></FollowUp></Column></Table>`,
      "Column",
    );
    expect(column.attrs.field).toBe("name");
    const hit = find(
      `<Table field="strikes"><Column label="Hit" formula="bonus"><Roll formula="d20 + value()" /></Column></Table>`,
      "Column",
    );
    const data = { strikes: [{ name: "Rapier", bonus: 7, damage: "2d6" }] };
    const row: SheetScope = { value: data.strikes[0], path: ["strikes", 0], item: { key: 0 } };
    const result = run(hit, data, { scope: row, shown: 7, random: faces(9) });
    expect(result).toMatchObject({ entries: [{ expression: "d20 + 7", total: 16 }] });
  });

  it("fails without writing when a roll can't be made", () => {
    const button = find(
      `<Button label="Bad"><Set field="heroPoints" formula="0" /><Roll formula="dice(damage)" /></Button>`,
      "Button",
    );
    expect(run(button, { heroPoints: 2, damage: "fireball" })).toEqual({
      error: "\"fireball\" isn't dice; write it like 2d6 + 3",
    });
    expect(run(button, { heroPoints: 2, damage: "200d6" })).toEqual({ error: "A roll can have at most 100 dice" });
  });

  it("prints expressions as players write them", () => {
    const button = find(`<Button label="X"><Roll formula="(d6 - 1) - (d4 + 2) / 2 * -d8" /></Button>`, "Button");
    const result = run(button, {});
    if (!("entries" in result)) throw new Error(result.error);
    expect(printRollTerm(result.entries[0]!.term)).toBe("d6 − 1 − (d4 + 2) ÷ 2 × −d8");
  });
});
