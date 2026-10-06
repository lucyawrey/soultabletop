import { describe, expect, it } from "vitest";
import { isFormulaError } from "./formula";
import { sheetBreakdown, type SheetScope } from "./runtime";
import { compileSheet, type SheetSchemas, type ValidatedElement, type ValidatedNode } from "./validate";

// <Part>: the parts of a number, listed in its breakdown popover.

const schemas: SheetSchemas = {
  root: {
    hasStrictSchema: true,
    showSheetWarnings: true,
    schema: {
      dex: { type: "number" },
      rank: { type: "number", options: [{ value: 0, label: "Untrained" }, { value: 1, label: "Trained" }] },
      shieldRaised: { type: "boolean" },
      ac: { type: "number" },
      name2: { type: "string" },
      skills: {
        type: "struct",
        entries: {
          acrobatics: { type: "struct", entries: { rank: { type: "number" } } },
          stealth: { type: "struct", entries: { rank: { type: "number" } } },
        },
      },
    },
  },
  types: {},
};

const messages = (markup: string) =>
  compileSheet(markup, schemas).diagnostics.map((item) => `${item.severity} ${item.code}: ${item.message}`);

function tags(markup: string, tag: string): ValidatedElement[] {
  const compiled = compileSheet(markup, schemas);
  expect(compiled.diagnostics).toEqual([]);
  const found: ValidatedElement[] = [];
  const visit = (nodes: ValidatedNode[]) => {
    for (const node of nodes) {
      if (node.type !== "element") continue;
      if (node.tag === tag) found.push(node);
      visit(node.children);
    }
  };
  visit(compiled.nodes);
  return found;
}

const acMarkup = `
  <Define name="prof" params="r" formula="if(r > 0, r * 2 + 1, 0)" />
  <Value label="Armor Class">
    <Part label="Base" formula="10" />
    <Part label="Dex" formula="dex" />
    <Part label="{rank}" formula="prof(rank)" />
    <Part label="Shield" formula="2" show="shieldRaised" />
  </Value>`;

describe("Part validation", () => {
  it("accepts parts on Value, Column, and Number with a formula", () => {
    expect(messages(acMarkup)).toEqual([]);
    expect(
      messages(`
        <Number field="ac" formula="10 + dex"><Part label="Base" formula="10" /><Part label="Dex" formula="dex" /></Number>
        <Value formula="dex" format="signed"><Part label="Dex" formula="dex" /></Value>
        <Table field="skills">
          <Column formula="itemLabel()" label="Skill" />
          <Column label="Mod" format="signed"><Part label="Rank" formula="rank" /></Column>
        </Table>`),
    ).toEqual([]);
  });

  it("needs number parts, and a formula on Number", () => {
    expect(messages(`<Value><Part label="Name" formula="name2" /></Value>`)).toEqual([
      "error formula-result-type: <Part>'s formula must give a number, but it gives text",
    ]);
    expect(messages(`<Number field="ac"><Part label="Dex" formula="dex" /></Number>`)).toEqual([
      "error missing-attribute: <Number> with parts needs a formula; its parts explain it (use <Value> to show their sum)",
    ]);
    expect(messages(`<Part label="Dex" formula="dex" />`)).toEqual([
      "error misplaced-tag: <Part> must be directly inside <Value> or <Number> or <Column>",
    ]);
    expect(messages(`<Text field="name2"><Part label="Dex" formula="dex" /></Text>`)).toEqual([
      "error child-not-allowed: <Text> can't contain other tags",
    ]);
    expect(messages(`<Value field="dex"><Part label="Dex" formula="dex" /></Value>`)).toEqual([
      "error invalid-attribute: <Value> with parts takes no field: without a formula it shows their sum (with a formula, parts explain it)",
    ]);
    expect(messages(`<Value><Part label="Dex" formula="dex" class="x" /></Value>`)[0]).toContain(
      "error unknown-attribute: <Part> has no class attribute",
    );
    expect(messages(`<Value><Part formula="dex" /></Value>`)).toEqual([
      "error missing-attribute: <Part> needs a label attribute",
    ]);
  });
});

describe("sheetBreakdown", () => {
  const [ac] = tags(acMarkup, "Value");
  const compiled = compileSheet(acMarkup, schemas);
  const formulas = { definitions: compiled.definitions };
  const run = (node: ValidatedElement, data: Record<string, unknown>, scope?: SheetScope) => {
    const root = { value: data, path: [] };
    return sheetBreakdown(node, root, scope ?? root, {}, formulas);
  };

  it("lists the shown parts with interpolated labels, and sums them", () => {
    expect(run(ac!, { dex: 3, rank: 1, shieldRaised: false })).toEqual({
      parts: [
        { label: "Base", value: 10 },
        { label: "Dex", value: 3 },
        { label: "Trained", value: 3 },
      ],
      total: 16,
    });
    expect(run(ac!, { dex: 3, rank: 1, shieldRaised: true }).total).toBe(18);
  });

  it("leaves out parts that are nothing", () => {
    expect(run(ac!, { rank: 0 })).toEqual({
      parts: [
        { label: "Base", value: 10 },
        { label: "Untrained", value: 0 },
      ],
      total: 10,
    });
  });

  it("gives nothing when no part is left", () => {
    const [value] = tags(`<Value><Part label="Shield" formula="2" show="shieldRaised" /></Value>`, "Value");
    expect(run(value!, { shieldRaised: false })).toEqual({ parts: [], total: null });
  });

  it("makes the sum an error when a part fails", () => {
    const [value] = tags(`<Value><Part label="Half" formula="dex / 0" /><Part label="Base" formula="10" /></Value>`, "Value");
    const { total, parts } = run(value!, { dex: 4 });
    expect(isFormulaError(total)).toBe(true);
    expect(parts).toHaveLength(2);
  });

  it("works per row in a Table Column", () => {
    const [column] = tags(
      `<Table field="skills"><Column label="Mod"><Part label="Rank" formula="rank" /><Part label="Dex" formula="/dex" /></Column></Table>`,
      "Column",
    );
    const data = { dex: 2, skills: { stealth: { rank: 4 } } };
    const row: SheetScope = { value: data.skills.stealth, path: ["skills", "stealth"], item: { key: "stealth" } };
    expect(run(column!, data, row).total).toBe(6);
  });
});
