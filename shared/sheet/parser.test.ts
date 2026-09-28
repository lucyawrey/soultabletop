import { describe, expect, it } from "vitest";
import {
  isValidSheetPath,
  parseSheetMarkup,
  sheetParseLimits,
  type SheetElement,
  type SheetNode,
  type SheetText,
} from "./parser";

function element(node: SheetNode | undefined): SheetElement {
  expect(node?.type).toBe("element");
  return node as SheetElement;
}

function text(node: SheetNode | undefined): SheetText {
  expect(node?.type).toBe("text");
  return node as SheetText;
}

function codes(source: string) {
  return parseSheetMarkup(source).diagnostics.map((item) => item.code);
}

// Strips locations so trees can be compared structurally.
function shape(nodes: SheetNode[]): unknown[] {
  return nodes.map((node) =>
    node.type === "text"
      ? node.parts.map((part) => (typeof part === "string" ? part : { path: part.path }))
      : {
          tag: node.tag,
          attrs: Object.fromEntries(
            node.attrs.map((attr) => [
              attr.name,
              attr.value === true
                ? true
                : attr.value.map((part) => (typeof part === "string" ? part : { path: part.path })),
            ]),
          ),
          ...(node.selfClosing ? { selfClosing: true } : {}),
          children: shape(node.children),
        },
  );
}

describe("valid markup", () => {
  it("parses nested elements, attributes, and self-closing tags", () => {
    const result = parseSheetMarkup(`
      <Section title="Abilities">
        <Grid cols='3'>
          <Number field="str" label="STR" />
          <Text field="notes" multiline />
        </Grid>
      </Section>
    `);
    expect(result.diagnostics).toEqual([]);
    expect(shape(result.nodes)).toEqual([
      {
        tag: "Section",
        attrs: { title: ["Abilities"] },
        children: [
          {
            tag: "Grid",
            attrs: { cols: ["3"] },
            children: [
              { tag: "Number", attrs: { field: ["str"], label: ["STR"] }, selfClosing: true, children: [] },
              { tag: "Text", attrs: { field: ["notes"], multiline: true }, selfClosing: true, children: [] },
            ],
          },
        ],
      },
    ]);
  });

  it("allows whitespace around = and attributes without spaces between them", () => {
    const result = parseSheetMarkup(`<Grid cols = "2"gap="sm"></Grid>`);
    expect(result.diagnostics).toEqual([]);
    expect(element(result.nodes[0]).attrs.map((attr) => attr.name)).toEqual(["cols", "gap"]);
  });

  it("matches closing tags case-insensitively and keeps the tag as written", () => {
    const result = parseSheetMarkup("<section>Hi</SECTION>");
    expect(result.diagnostics).toEqual([]);
    expect(element(result.nodes[0]).tag).toBe("section");
  });

  it("returns empty output for empty markup", () => {
    expect(parseSheetMarkup("")).toEqual({ nodes: [], diagnostics: [] });
    expect(parseSheetMarkup("  \n\t ")).toEqual({ nodes: [], diagnostics: [] });
  });
});

describe("text", () => {
  it("collapses whitespace, trims, and drops whitespace-only text", () => {
    const result = parseSheetMarkup("<Note>\n   Raised   by\n wolves.  </Note>\n\n<Divider />");
    expect(shape(result.nodes)).toEqual([
      { tag: "Note", attrs: {}, children: [["Raised by wolves."]] },
      { tag: "Divider", attrs: {}, selfClosing: true, children: [] },
    ]);
  });

  it("allows text at the top level and between elements", () => {
    const result = parseSheetMarkup("Intro <Divider /> outro");
    expect(shape(result.nodes)).toEqual([
      ["Intro"],
      { tag: "Divider", attrs: {}, selfClosing: true, children: [] },
      ["outro"],
    ]);
  });

  it("splits interpolations into parts with locations", () => {
    const result = parseSheetMarkup("Hi {name}, level { stats.level }!");
    expect(result.diagnostics).toEqual([]);
    const node = text(result.nodes[0]);
    expect(shape([node])).toEqual([["Hi ", { path: "name" }, ", level ", { path: "stats.level" }, "!"]]);
    const interpolation = node.parts[1];
    expect(typeof interpolation === "object" && interpolation.loc).toEqual({
      start: { line: 1, column: 4, offset: 3 },
      end: { line: 1, column: 10, offset: 9 },
    });
  });

  it("supports root paths, the current item, and numeric segments", () => {
    const node = text(parseSheetMarkup("{/name} {.} {attacks.0.name}").nodes[0]);
    expect(shape([node])).toEqual([[{ path: "/name" }, " ", { path: "." }, " ", { path: "attacks.0.name" }]]);
  });

  it("keeps whitespace between interpolations but trims the ends", () => {
    const node = text(parseSheetMarkup("  {a}   {b}  ").nodes[0]);
    expect(shape([node])).toEqual([[{ path: "a" }, " ", { path: "b" }]]);
  });

  it("handles escapes", () => {
    const node = text(parseSheetMarkup("\\{not a path\\} and \\\\ and \\n").nodes[0]);
    expect(shape([node])).toEqual([["{not a path} and \\ and \\n"]]);
  });

  it("decodes named and numeric entities", () => {
    const node = text(parseSheetMarkup("&lt;b&gt; &amp; &quot;&apos; &#123; &#x7D; & alone").nodes[0]);
    expect(shape([node])).toEqual([["<b> & \"' { } & alone"]]);
  });

  it("warns about unknown entities and keeps them literally", () => {
    const result = parseSheetMarkup("a &nbsp; b");
    expect(shape(result.nodes)).toEqual([["a &nbsp; b"]]);
    expect(result.diagnostics).toMatchObject([{ code: "unknown-entity", severity: "warning" }]);
  });

  it("skips comments", () => {
    const result = parseSheetMarkup("a<!-- <Section> {x} -->b");
    expect(result.diagnostics).toEqual([]);
    expect(shape(result.nodes)).toEqual([["a"], ["b"]]);
  });
});

describe("attribute values", () => {
  it("keep whitespace and support interpolation", () => {
    const result = parseSheetMarkup(`<Tracker field="hp" max="{hpMax}" label="  Hit  Points " />`);
    expect(result.diagnostics).toEqual([]);
    expect(shape(result.nodes)).toEqual([
      {
        tag: "Tracker",
        attrs: { field: ["hp"], max: [{ path: "hpMax" }], label: ["  Hit  Points "] },
        selfClosing: true,
        children: [],
      },
    ]);
  });

  it("can contain > and the other quote", () => {
    const result = parseSheetMarkup(`<Note title='Say "hi" > bye' />`);
    expect(result.diagnostics).toEqual([]);
    expect(shape(result.nodes)).toEqual([
      { tag: "Note", attrs: { title: ["Say \"hi\" > bye"] }, selfClosing: true, children: [] },
    ]);
  });

  it("can be empty", () => {
    const result = parseSheetMarkup(`<Note title="" />`);
    expect(result.diagnostics).toEqual([]);
    expect(element(result.nodes[0]).attrs[0]!.value).toEqual([]);
  });
});

describe("locations", () => {
  it("reports 1-based lines and columns across lines", () => {
    const result = parseSheetMarkup("<Section>\n  <Text field=\"a\" />\n</Section>");
    const section = element(result.nodes[0]);
    expect(section.loc).toEqual({
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 3, column: 11, offset: 41 },
    });
    const child = element(section.children[0]);
    expect(child.loc.start).toEqual({ line: 2, column: 3, offset: 12 });
    // `field="a"` spans columns 9–17; the end position is exclusive.
    expect(child.attrs[0]!.loc).toEqual({
      start: { line: 2, column: 9, offset: 18 },
      end: { line: 2, column: 18, offset: 27 },
    });
  });
});

describe("errors and recovery", () => {
  it("reports an element that is never closed", () => {
    const result = parseSheetMarkup("<Section>\n  <Text field=\"a\" />");
    expect(result.diagnostics).toMatchObject([
      {
        code: "unclosed-element",
        severity: "error",
        loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } },
      },
    ]);
    // The unclosed element still holds its children.
    expect(element(result.nodes[0]).children).toHaveLength(1);
  });

  it("auto-closes inner elements when an outer one closes, and keeps going", () => {
    const result = parseSheetMarkup(
      "<Section><Grid><Text field=\"a\" /></Section><Divider />",
    );
    expect(result.diagnostics).toMatchObject([
      { code: "unclosed-element", message: expect.stringContaining("<Grid>") },
    ]);
    expect(shape(result.nodes)).toEqual([
      {
        tag: "Section",
        attrs: {},
        children: [
          {
            tag: "Grid",
            attrs: {},
            children: [{ tag: "Text", attrs: { field: ["a"] }, selfClosing: true, children: [] }],
          },
        ],
      },
      { tag: "Divider", attrs: {}, selfClosing: true, children: [] },
    ]);
  });

  it("ignores a closing tag that matches nothing", () => {
    const result = parseSheetMarkup("<Section></Grid>text</Section>");
    expect(result.diagnostics).toMatchObject([
      { code: "unexpected-close-tag", loc: { start: { column: 10 }, end: { column: 17 } } },
    ]);
    expect(shape(result.nodes)).toEqual([{ tag: "Section", attrs: {}, children: [["text"]] }]);
  });

  it("reports duplicate attributes case-insensitively and keeps the first", () => {
    const result = parseSheetMarkup(`<Grid cols="2" COLS="3" />`);
    expect(codes(`<Grid cols="2" COLS="3" />`)).toEqual(["duplicate-attribute"]);
    expect(shape(result.nodes)).toEqual([
      { tag: "Grid", attrs: { cols: ["2"] }, selfClosing: true, children: [] },
    ]);
  });

  it("reports unquoted values but still uses them", () => {
    const result = parseSheetMarkup("<Grid cols=3 gap=sm/>");
    expect(result.diagnostics.map((item) => item.code)).toEqual(["unquoted-attribute", "unquoted-attribute"]);
    expect(shape(result.nodes)).toEqual([
      { tag: "Grid", attrs: { cols: ["3"], gap: ["sm"] }, selfClosing: true, children: [] },
    ]);
  });

  it("reports a missing value after =", () => {
    expect(codes("<Grid cols= />")).toEqual(["missing-attribute-value"]);
  });

  it("recovers from an unterminated attribute value at the tag's >", () => {
    const result = parseSheetMarkup("<Note title=\"oops>Body</Note>");
    expect(result.diagnostics.map((item) => item.code)).toEqual(["unterminated-attribute"]);
    expect(shape(result.nodes)).toEqual([
      { tag: "Note", attrs: { title: ["oops"] }, children: [["Body"]] },
    ]);
  });

  it("reports unexpected characters inside a tag", () => {
    const result = parseSheetMarkup(`<Grid "cols"="2">x</Grid>`);
    expect(result.diagnostics[0]).toMatchObject({
      code: "unexpected-character",
      loc: { start: { column: 7 }, end: { column: 8 } },
    });
    expect(element(result.nodes[0]).children).toHaveLength(1);
  });

  it("reports an opening tag missing its > and treats it as open", () => {
    const result = parseSheetMarkup("<Section title=\"a\"\n<Text field=\"b\" />\n</Section>");
    expect(result.diagnostics.map((item) => item.code)).toEqual(["unterminated-tag"]);
    expect(shape(result.nodes)).toEqual([
      {
        tag: "Section",
        attrs: { title: ["a"] },
        children: [{ tag: "Text", attrs: { field: ["b"] }, selfClosing: true, children: [] }],
      },
    ]);
  });

  it("reports a closing tag missing its >", () => {
    const result = parseSheetMarkup("<Section>a</Section");
    expect(result.diagnostics.map((item) => item.code)).toEqual(["unterminated-tag"]);
    expect(shape(result.nodes)).toEqual([{ tag: "Section", attrs: {}, children: [["a"]] }]);
  });

  it("reports a stray < and keeps it as text", () => {
    const result = parseSheetMarkup("1 < 2 and </ 3");
    expect(result.diagnostics.map((item) => item.code)).toEqual(["stray-less-than", "stray-less-than"]);
    expect(shape(result.nodes)).toEqual([["1 < 2 and </ 3"]]);
  });

  it("reports an unterminated comment", () => {
    const result = parseSheetMarkup("a <!-- never closed <Section>");
    expect(result.diagnostics.map((item) => item.code)).toEqual(["unterminated-comment"]);
    expect(shape(result.nodes)).toEqual([["a"]]);
  });

  it("reports bad interpolations and drops them", () => {
    const result = parseSheetMarkup("a {} b {not a path} c {open");
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      "empty-interpolation",
      "invalid-path",
      "unterminated-interpolation",
    ]);
    expect(shape(result.nodes)).toEqual([["a b c {open"]]);
  });

  it("does not let an unterminated interpolation in text run past the next tag", () => {
    const result = parseSheetMarkup("<Note>{oops</Note><Divider />");
    expect(result.diagnostics.map((item) => item.code)).toEqual(["unterminated-interpolation"]);
    expect(result.nodes).toHaveLength(2);
  });

  it("collects several independent errors in one pass", () => {
    expect(
      codes(`<Grid cols=2>\n<Text field="a" field="b" />\n{}\n</Stack>\n`),
    ).toEqual([
      "unquoted-attribute",
      "duplicate-attribute",
      "empty-interpolation",
      "unexpected-close-tag",
      "unclosed-element",
    ]);
  });
});

describe("limits", () => {
  it("rejects source over the length limit", () => {
    const result = parseSheetMarkup("a".repeat(sheetParseLimits.maxSourceLength + 1));
    expect(result.nodes).toEqual([]);
    expect(result.diagnostics.map((item) => item.code)).toEqual(["source-too-long"]);
  });

  it("stops at the nesting limit", () => {
    const depth = sheetParseLimits.maxDepth + 1;
    const source = "<Stack>".repeat(depth) + "</Stack>".repeat(depth);
    expect(codes(source)).toEqual(["too-deep"]);
    const allowed = "<Stack>".repeat(depth - 1) + "</Stack>".repeat(depth - 1);
    expect(codes(allowed)).toEqual([]);
  });

  it("allows self-closing tags at the deepest level", () => {
    const depth = sheetParseLimits.maxDepth;
    const source = "<Stack>".repeat(depth) + "<Divider />" + "</Stack>".repeat(depth);
    expect(codes(source)).toEqual([]);
  });

  it("stops at the node limit", () => {
    const source = "<Divider />".repeat(sheetParseLimits.maxNodes + 1);
    const result = parseSheetMarkup(source);
    expect(result.diagnostics.map((item) => item.code)).toEqual(["too-many-nodes"]);
    expect(result.nodes).toHaveLength(sheetParseLimits.maxNodes);
  });
});

describe("isValidSheetPath", () => {
  it.each(["name", "/name", ".", "stats.str", "attacks.0.name", "_x", "/a.b"])("accepts %s", (path) => {
    expect(isValidSheetPath(path)).toBe(true);
  });
  it.each(["", "/", "/.", "a.", ".a", "0", "a..b", "a b", "a-b", "a.b.", "../a"])("rejects %j", (path) => {
    expect(isValidSheetPath(path)).toBe(false);
  });
});
