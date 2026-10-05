import { describe, expect, it } from "vitest";
import {
  formulaLimits,
  parseFormula,
  printFormula,
  type FormulaNode,
  type FormulaParseOptions,
} from "./formula";
import { checkFormula, type FormulaCheckHost } from "./formula-check";
import { evaluateFormula, formulaBudget } from "./formula-eval";
import { formulaTypes } from "./formula";
import type { Position } from "./parser";

const origin: Position = { line: 1, column: 1, offset: 0 };

function parse(source: string, options?: FormulaParseOptions) {
  return parseFormula(source, origin, options);
}

function print(source: string, options?: FormulaParseOptions) {
  const { ast, diagnostics } = parse(source, options);
  expect(diagnostics).toEqual([]);
  return printFormula(ast!);
}

function ast(source: string, options?: FormulaParseOptions) {
  const result = parse(source, options);
  expect(result.diagnostics).toEqual([]);
  return strip(result.ast!);
}

// The tree without locations.
function strip(node: FormulaNode): unknown {
  return JSON.parse(
    JSON.stringify(node, (key, value: unknown) =>
      key === "loc" || key === "nameLoc" ? undefined : value,
    ),
  );
}

function error(source: string, start: Position = origin) {
  const { ast: tree, diagnostics } = parseFormula(source, start);
  expect(tree).toBeUndefined();
  expect(diagnostics).toHaveLength(1);
  return diagnostics[0]!;
}

describe("operators", () => {
  it.each([
    ["1 + 2 * 3", "(1 + (2 * 3))"],
    ["(1 + 2) * 3", "((1 + 2) * 3)"],
    ["1 - 2 - 3", "((1 - 2) - 3)"],
    ["8 / 4 / 2", "((8 / 4) / 2)"],
    ["7 % 3 * 2", "((7 % 3) * 2)"],
    ["a or b and c", "(a or (b and c))"],
    ["a and b or c", "((a and b) or c)"],
    ["a == b and c != d", "((a == b) and (c != d))"],
    ["a == b == c", "((a == b) == c)"],
    ["1 < 2 == true", "((1 < 2) == true)"],
    ["a + 1 >= b * 2", "((a + 1) >= (b * 2))"],
    ["a <= b", "(a <= b)"],
    ["a > b", "(a > b)"],
    ["-a * b", "((-a) * b)"],
    ["- -a", "(-(-a))"],
    ["not a == b", "((not a) == b)"],
    ["not not a", "(not (not a))"],
    ["not (a and b)", "(not (a and b))"],
  ])("%s", (source, printed) => {
    expect(print(source)).toBe(printed);
  });

  it("doesn't chain comparisons", () => {
    expect(error("a < b < c").message).toMatch(/can't be chained/);
    expect(error("a < b + 1 >= c").message).toMatch(/can't be chained/);
  });

  it.each([
    ["a = b", "Use == to compare values"],
    ["a && b", "Use and instead of &&"],
    ["a || b", "Use or instead of ||"],
    ["!a", "Use not instead of !"],
    ["+1", "Write the number without a + sign"],
    ["{level}", "Unexpected \"{\"; inside a formula, refer to fields by name, like level, without braces"],
    ["a ? b : c", "Unexpected \"?\""],
  ])("explains %s", (source, message) => {
    expect(error(source).message).toBe(message);
  });
});

describe("paths", () => {
  it("reads / as the top level before a value and as division after one", () => {
    expect(ast("/level")).toEqual({
      type: "path",
      path: { absolute: true, segments: ["level"] },
      text: "/level",
    });
    expect(print("a / b")).toBe("(a / b)");
    expect(print("a/b")).toBe("(a / b)");
    expect(print("10 /level")).toBe("(10 / level)");
    expect(print("(a)/b")).toBe("(a / b)");
    expect(print("1 / /a.b")).toBe("(1 / /a.b)");
    expect(print("-/a")).toBe("(-/a)");
    expect(print("max(/a, 1)")).toBe("max(/a, 1)");
    expect(print("true / 2")).toBe("(true / 2)");
  });

  it("parses dotted paths, indexes, and . for the item", () => {
    expect(ast("stats.str")).toMatchObject({ path: { absolute: false, segments: ["stats", "str"] } });
    expect(ast("attacks.0.name")).toMatchObject({ path: { segments: ["attacks", "0", "name"] } });
    expect(ast(".")).toMatchObject({ path: { absolute: false, segments: [] }, text: "." });
    expect(ast(".qty")).toMatchObject({ path: { absolute: false, segments: ["qty"] } });
    expect(ast("/a.b")).toMatchObject({ path: { absolute: true, segments: ["a", "b"] } });
  });

  it("reaches fields named like reserved words with / or .", () => {
    expect(ast(".and")).toMatchObject({ type: "path", path: { segments: ["and"] } });
    expect(ast("/null")).toMatchObject({ type: "path", path: { absolute: true, segments: ["null"] } });
    expect(ast("stats.not")).toMatchObject({ type: "path", path: { segments: ["stats", "not"] } });
    expect(ast("nullish")).toMatchObject({ type: "path", text: "nullish" });
  });

  it.each([
    ["__proto__", "\"__proto__\" uses a reserved name (__proto__, constructor, prototype)"],
    ["a.constructor", "\"a.constructor\" uses a reserved name (__proto__, constructor, prototype)"],
    ["/prototype", "\"/prototype\" uses a reserved name (__proto__, constructor, prototype)"],
    ["a.", "Unexpected \".\"; expected an operator like + or and"],
    ["/", "/ needs a field name after it, like /level"],
    ["/1", "/ needs a field name after it, like /level"],
    ["a.1b", "Field names can't start with a digit"],
    ["and", "Unexpected \"and\"; expected a value"],
  ])("rejects %s", (source, message) => {
    expect(error(source).message).toBe(message);
  });
});

describe("calls and parameters", () => {
  it("parses calls with any number of arguments", () => {
    expect(ast("pb()")).toEqual({ type: "call", name: "pb", args: [] });
    expect(print("floor(x)")).toBe("floor(x)");
    expect(print("max(a, b + 1, min(c, 2))")).toBe("max(a, (b + 1), min(c, 2))");
    expect(print("if (a, 1, 2)")).toBe("if(a, 1, 2)");
  });

  it("keeps `not (` a unary operator", () => {
    expect(ast("not(a)")).toMatchObject({ type: "unary", op: "not" });
  });

  it("reads paths on call results", () => {
    expect(ast("first(a).b")).toEqual({
      type: "member",
      target: { type: "call", name: "first", args: [{ type: "path", path: { absolute: false, segments: ["a"] }, text: "a" }] },
      path: { absolute: false, segments: ["b"] },
      text: ".b",
    });
    expect(print("first(a, c).b.c + 1")).toBe("(first(a, c).b.c + 1)");
    expect(print("at(a, 0).b / 2")).toBe("(at(a, 0).b / 2)");
    expect(error("first(a) .b").message).toMatch(/^Unexpected "\.b"/);
    expect(error("first(a).0").message).toBe(
      "A number can't start with a dot; to pick an item by its index, use at, like at(attacks, 0)",
    );
    expect(error("first(a) .5").message).toBe("A number can't start with a dot; write 0.5 instead of .5");
    expect(error("first(a).b(1)").message).toMatch(/isn't a function name/);
    expect(error("first(a).constructor").message).toMatch(/reserved name/);
  });

  it("rejects calls on paths", () => {
    expect(error("a.b(1)").message).toMatch(/isn't a function name/);
    expect(error("/a(1)").message).toMatch(/isn't a function name/);
  });

  it("reads parameters as parameters, and /name as the field", () => {
    const options = { params: ["rank"] };
    expect(ast("rank", options)).toEqual({ type: "param", name: "rank" });
    expect(ast("/rank", options)).toMatchObject({ type: "path", text: "/rank" });
    expect(ast("rank.x", options)).toMatchObject({ type: "path", text: "rank.x" });
    expect(ast("rank", {})).toMatchObject({ type: "path" });
  });

  it.each([
    ["f(1,)", "Unexpected \")\"; expected a value"],
    ["f(1 2)", "Unexpected \"2\"; expected \",\" or \")\""],
    ["f(1", "Unexpected the end of the formula; expected \",\" or \")\""],
    ["(1", "Unexpected the end of the formula; expected \")\""],
    ["1)", "Unexpected \")\"; expected an operator like + or and"],
  ])("rejects %s", (source, message) => {
    expect(error(source).message).toBe(message);
  });
});

describe("literals", () => {
  it.each([
    ["12", { type: "number", value: 12 }],
    ["007", { type: "number", value: 7 }],
    ["1.25", { type: "number", value: 1.25 }],
    ["true", { type: "boolean", value: true }],
    ["false", { type: "boolean", value: false }],
    ["null", { type: "null" }],
    ["'it\\'s'", { type: "string", value: "it's" }],
    ["\"say \\\"hi\\\"\"", { type: "string", value: "say \"hi\"" }],
    ["'a\\\\b'", { type: "string", value: "a\\b" }],
    ["'}'", { type: "string", value: "}" }],
    ["''", { type: "string", value: "" }],
  ])("%s", (source, node) => {
    expect(ast(source)).toEqual(node);
  });

  it("lexes dice as one token", () => {
    expect(ast("2d6")).toEqual({ type: "dice", count: 2, sides: 6 });
    expect(ast("d20")).toEqual({ type: "dice", count: 1, sides: 20 });
    expect(print("1d20 + 5")).toBe("(1d20 + 5)");
    expect(ast("d6x")).toMatchObject({ type: "path", text: "d6x" });
    expect(ast("/d6")).toMatchObject({ type: "path", text: "/d6" });
  });

  it.each([
    ["1.", "A number needs digits after its dot, like 1.5"],
    [".5", "A number can't start with a dot; write 0.5 instead of .5"],
    ["2x", "\"2x\" isn't a number or a field name; field names can't start with a digit"],
    ["2d", "\"2d\" isn't a number or a field name; field names can't start with a digit"],
    ["2d6x", "\"2d6x\" looks like dice but isn't; dice look like 2d6"],
    [`1${"0".repeat(400)}`, "This number is too large"],
    ["'abc", "Text is missing its closing '"],
    ["'a\\nb'", "Use \\\\ for a backslash in text; only \\', \\\", and \\\\ are escapes"],
    ["", "The formula is empty"],
    ["   ", "The formula is empty"],
  ])("rejects %j", (source, message) => {
    expect(error(source).message).toBe(message);
  });
});

describe("locations", () => {
  it("points at the problem", () => {
    expect(error("1 +").loc).toEqual({
      start: { line: 1, column: 4, offset: 3 },
      end: { line: 1, column: 4, offset: 3 },
    });
    expect(error("a + * b").loc).toEqual({
      start: { line: 1, column: 5, offset: 4 },
      end: { line: 1, column: 6, offset: 5 },
    });
  });

  it("counts from where the formula starts in the markup, across lines", () => {
    const start = { line: 3, column: 10, offset: 40 };
    expect(error("a +\n  * b", start).loc.start).toEqual({ line: 4, column: 3, offset: 46 });
    const { ast: tree } = parseFormula("a +\n  bb", start);
    expect(tree!.type === "binary" && tree.right.loc).toEqual({
      start: { line: 4, column: 3, offset: 46 },
      end: { line: 4, column: 5, offset: 48 },
    });
  });

  it("decodes entities and keeps their positions in the markup", () => {
    expect(print("a &lt; b and c &gt;= d")).toBe("((a < b) and (c >= d))");
    const { ast: tree } = parse("a &lt; b");
    expect(strip(tree!)).toMatchObject({ type: "binary", op: "<" });
    expect(tree!.type === "binary" && tree.right.loc.start).toEqual({ line: 1, column: 8, offset: 7 });
    expect(print("'&quot;'")).toBe("'\"'");
    // A decoded &apos; is a quote like any other.
    expect(error("'&apos;'").message).toBe("Text is missing its closing '");
    // Unknown entities stay as written.
    expect(error("a &nbsp; b").loc.start.column).toBe(3);
  });

  it("rejects && written with entities", () => {
    expect(error("a &amp;&amp; b").message).toBe("Use and instead of &&");
  });

  it("locates calls and their names", () => {
    const { ast: tree } = parse("1 + floor(x)");
    expect(tree!.type === "binary" && tree.right).toMatchObject({
      type: "call",
      nameLoc: { start: { column: 5 }, end: { column: 10 } },
      loc: { start: { column: 5 }, end: { column: 13 } },
    });
  });
});

describe("limits", () => {
  it("limits the length", () => {
    const diagnostic = error(`a${" ".repeat(formulaLimits.maxLength)}`);
    expect(diagnostic.code).toBe("formula-too-large");
  });

  it("limits the number of nodes", () => {
    expect(parse(Array(100).fill("1").join(" + ")).diagnostics).toEqual([]);
    expect(error(Array(101).fill("1").join(" + ")).code).toBe("formula-too-large");
  });

  it("limits nesting", () => {
    const nested = (depth: number) => `${"(".repeat(depth)}1${")".repeat(depth)}`;
    expect(parse(nested(formulaLimits.maxDepth)).diagnostics).toEqual([]);
    expect(error(nested(formulaLimits.maxDepth + 1)).code).toBe("formula-too-large");
    expect(error(`${"-".repeat(40)}1`).code).toBe("formula-too-large");
  });

  it("limits arguments", () => {
    const call = (count: number) => `max(${Array(count).fill("1").join(", ")})`;
    expect(parse(call(formulaLimits.maxArgs)).diagnostics).toEqual([]);
    expect(error(call(formulaLimits.maxArgs + 1)).code).toBe("formula-too-large");
  });
});

// Random token soup: parsing, checking, and evaluating never throw and always
// finish; anything that parses prints and parses back to the same tree.
describe("fuzz", () => {
  // mulberry32
  function random(seed: number) {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  const tokens = [
    "1", "0", "2.5", "100000000000000000000000", "'a'", "\"b\"", "''", "true", "false", "null",
    "level", "stats.str", "/level", ".", ".qty", "list", "x", "2d6", "d20",
    "+", "-", "*", "/", "%", "==", "!=", "<", "<=", ">", ">=", "and", "or", "not",
    "(", ")", ",", "(", ")", "floor(", "max(", "sum(", "count(", "if(", "switch(", "coalesce(",
    "concat(", "get(", "length(", "round(", "f(", "g(", "roll(", "&lt;", "&amp;", "'", "\\", "{", "=",
    "__proto__", " ", "\n",
  ];

  const data = {
    level: 3,
    stats: { str: 2 },
    list: [{ qty: 1 }, { qty: 2 }, 3, null],
    x: "text",
  };
  const root = { value: data, path: [] };
  const host: FormulaCheckHost<null> = {
    resolve: () => ({ type: formulaTypes.any }),
    itemScope: () => null,
    definition: (name) => (name === "f" ? { params: [], type: formulaTypes.number } : undefined),
  };

  it("never throws, and round-trips what parses", () => {
    const next = random(20261002);
    let parsed = 0;
    for (let run = 0; run < 3000; run += 1) {
      const length = 1 + Math.floor(next() * 12);
      const source = Array.from({ length }, () => tokens[Math.floor(next() * tokens.length)]).join(
        next() < 0.5 ? " " : "",
      );
      const result = parse(source);
      if (!result.ast) {
        expect(result.diagnostics.length).toBe(1);
        continue;
      }
      parsed += 1;
      const printed = printFormula(result.ast);
      const again = parse(printed);
      expect(again.diagnostics, `${source} → ${printed}`).toEqual([]);
      expect(strip(again.ast!)).toEqual(strip(result.ast));

      checkFormula(result.ast, host, null);
      const budget = formulaBudget();
      evaluateFormula(result.ast, {
        root,
        scope: root,
        refs: {},
        call: (name) => (name === "f" ? 1 : undefined),
        budget,
      });
      expect(budget.steps).toBeGreaterThanOrEqual(-1);
    }
    expect(parsed).toBeGreaterThan(50);
  });
});
