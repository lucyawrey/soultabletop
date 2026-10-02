import { describe, expect, it } from "vitest";
import { MAX_SHEET_CSS_LENGTH, processSheetCss, scopeSheetSelector } from "./css";

const id = "3f2a9c1e-1111-4222-8333-444455556666";
const scope = `[data-sheet="${id}"]`;

function scoped(css: string) {
  return processSheetCss(css, id);
}

function codes(css: string) {
  return scoped(css).diagnostics.map((item) => `${item.severity} ${item.code}`);
}

describe("scopeSheetSelector", () => {
  it.each([
    [".stat", `${scope} .stat`],
    [".a, h3 > .b", `${scope} .a, ${scope} h3 > .b`],
    [":root", scope],
    ["html", scope],
    ["body .x", `${scope} .x`],
    ["body.x", `${scope}.x`],
    // `.dark` is an ordinary class (the site has no dark mode).
    [".dark .x", `${scope} .dark .x`],
    [".dark", `${scope} .dark`],
    [".dark-mode .x", `${scope} .dark-mode .x`],
    [".dark.x", `${scope} .dark.x`],
    ["*", `${scope} *`],
    [".sheet-section:hover", `${scope} .sheet-section:hover`],
    [".sheet-number .sheet-field-label", `${scope} .sheet-number .sheet-field-label`],
    [".sheet-field-value", `${scope} .sheet-field-value`],
  ])("%s -> %s", (selector, expected) => {
    expect(scopeSheetSelector(selector, id)).toBe(expected);
  });
});

describe("selectors that would reach outside the Sheet", () => {
  // Each of these used to scope to something matching elements outside the
  // Sheet (found in the security review).
  it.each([
    "div:not(:root) { display: none }",
    "*:not(html) { opacity: 0 }",
    "*:has(:root) { background: red }",
    ":is(html) button::after { content: 'x' }",
    ":root ~ * { display: none }",
    ":root + div { display: none }",
    "html.x ~ * { color: red }",
    "@layer a { body ~ * { color: red } }",
    "@media (min-width: 1px) { .a:not(:root) { color: red } }",
    "~ .x { color: red }",
    "+ .x { color: red }",
    ".x { *:not(&) { outline: 5px solid red } }",
    ".x { *:has(&) { color: red } }",
    ".x { :is(&) ~ * { color: red } }",
    ":root { & ~ * { display: none } }",
    ":root { ~ * { display: none } }",
    ":root { &:hover + * { color: red } }",
    ":root { &:hover { & ~ * { color: red } } }",
    ":root { @media (min-width: 1px) { & ~ * { color: red } } }",
  ])("rejects %s", (css) => {
    const result = scoped(css);
    expect(result.diagnostics.map((item) => `${item.severity} ${item.code}`)).toContain("error css-selector");
    // Nothing unscoped survives: every remaining rule is inside the Sheet.
    expect(result.css).not.toMatch(/:not\(\[data-sheet|:has\(\[data-sheet|\[data-sheet="[^"]+"\]\s*[~+]|&\s*[~+]|:not\(&\)|:has\(&\)/);
    // The same CSS is rejected when only checking (as on save).
    expect(processSheetCss(css).diagnostics.map((item) => item.code)).toContain("css-selector");
  });

  it.each([
    [":root { --accent: red }", `${scope} { --accent: red }`],
    ["html .x { color: red }", `${scope} .x { color: red }`],
    [":root > .x { color: red }", `${scope} > .x { color: red }`],
    [".a ~ .b { color: red }", `${scope} .a ~ .b { color: red }`],
    [".x { &:hover { color: red } }", `${scope} .x { &:hover { color: red } }`],
    [".x { & ~ .y { color: red } }", `${scope} .x { & ~ .y { color: red } }`],
    [".x { .y + .z { color: red } }", `${scope} .x { .y + .z { color: red } }`],
    [":root { .a ~ .b { color: red } }", `${scope} { .a ~ .b { color: red } }`],
    [":root { & > .x { color: red } }", `${scope} { & > .x { color: red } }`],
    [".dark .x { color: red }", `${scope} .dark .x { color: red }`],
    [".dark { & ~ * { color: red } }", `${scope} .dark { & ~ * { color: red } }`],
    ["@media print { .x { display: none } }", `@media print { ${scope} .x { display: none } }`],
    [".a:not(.b) { color: red }", `${scope} .a:not(.b) { color: red }`],
  ])("still allows %s", (css, expected) => {
    const result = scoped(css);
    expect(result.diagnostics).toEqual([]);
    expect(result.css).toBe(expected);
  });

  it("explains why a selector was rejected", () => {
    expect(scoped("div:not(:root) { color: red }").diagnostics[0]?.message).toContain(
      ":root can only start a selector",
    );
  });
});

describe("processSheetCss", () => {
  it("scopes rules, including inside allowed at-rules", () => {
    const result = scoped(
      ".stat { color: red }\n@media (min-width: 40rem) { .stat { color: blue } }\n@supports (display: grid) { :root { --accent: red } }",
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.css).toBe(
      `${scope} .stat { color: red }\n@media (min-width: 40rem) { ${scope} .stat { color: blue } }\n@supports (display: grid) { ${scope} { --accent: red } }`,
    );
  });

  it("renames keyframes and the animations that use them", () => {
    const result = scoped(
      "@keyframes pulse { from { opacity: 0 } to { opacity: 1 } }\n.a { animation: pulse 2s infinite; } .b { animation-name: pulse, other }",
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.css).toContain("@keyframes pulse-3f2a9c1e { from { opacity: 0 } to { opacity: 1 } }");
    expect(result.css).toContain("animation: pulse-3f2a9c1e 2s infinite;");
    expect(result.css).toContain("animation-name: pulse-3f2a9c1e, other");
  });

  it("leaves nested rules relative to their parent", () => {
    expect(scoped(".a { & .b { color: red } }").css).toBe(`${scope} .a { & .b { color: red } }`);
  });

  it.each([
    ["@import 'x.css';", "error css-at-rule"],
    ["@font-face { font-family: X; src: local(X) }", "error css-at-rule"],
    ["@namespace svg url(x);", "error css-at-rule"],
    [".a { background: url(https://example.com/x.png) }", "error css-function"],
    [".a { background: URL( 'x' ) }", "error css-function"],
    [".a { background: \\75 rl(x) }", "error css-function"],
    [".a { background: image-set('x.png' 1x) }", "error css-function"],
    [".a { width: expression(alert(1)) }", "error css-function"],
    [".a { behavior: url(x.htc) }", "error css-property"],
    [".a { -moz-binding: x }", "error css-property"],
  ])("rejects %s", (css, code) => {
    const result = scoped(css);
    expect(result.diagnostics.map((item) => `${item.severity} ${item.code}`)).toEqual([code]);
    expect(result.css).not.toMatch(/url|import|font-face|namespace|expression|image-set|behavior|binding/i);
  });

  it("keeps the rest of the CSS when dropping rejected parts", () => {
    const result = scoped(".a { color: red; background: url(x) }");
    expect(result.css).toBe(`${scope} .a { color: red }`);
  });

  it("allows gradients and other functions that don't load files", () => {
    expect(codes(".a { background: linear-gradient(red, blue); width: calc(100% - var(--x)); color: rgb(0 0 0) }")).toEqual([]);
  });

  it("warns about fonts that aren't in the Sheet font list", () => {
    expect(codes(".a { font-family: \"Cinzel\", serif } .b { font-family: var(--f), 'IM Fell English' }")).toEqual([]);
    expect(scoped(".a { font-family: Papyrus, serif }").diagnostics).toMatchObject([
      { severity: "warning", code: "css-font", message: expect.stringContaining("\"Papyrus\"") },
    ]);
  });

  it("reports syntax errors with a location", () => {
    const result = scoped(".a {\n  color: red;\n");
    expect(result.css).toBe("");
    expect(result.diagnostics).toMatchObject([
      { severity: "error", code: "css-syntax", loc: { start: { line: 1, column: 1 } } },
    ]);
  });

  it("reports rejected constructs at their location", () => {
    const [diagnostic] = scoped(".a {\n  color: red;\n  background: url(x);\n}").diagnostics;
    expect(diagnostic?.loc.start).toMatchObject({ line: 3, column: 3 });
  });

  it("reports problems in source order", () => {
    const result = scoped(".b { background: url(x) }\n@import 'y.css';\n.c { behavior: z }");
    expect(result.diagnostics.map((item) => item.loc.start.line)).toEqual([1, 2, 3]);
  });

  it("escapes < so the CSS can't close its <style> element", () => {
    const result = scoped(".a::after { content: \"</style><script>\" } /* </style> */");
    expect(result.css).not.toContain("<");
    expect(result.css).toContain("\\3c /style>");
  });

  it("rejects CSS over the length limit", () => {
    expect(codes(`.a{}${" ".repeat(MAX_SHEET_CSS_LENGTH)}`)).toEqual(["error css-too-long"]);
  });

  it("only checks when no scope ID is given", () => {
    const result = processSheetCss(".a { color: red } @import 'x';");
    expect(result.css).toBe("");
    expect(result.diagnostics.map((item) => item.code)).toEqual(["css-at-rule"]);
  });

  it("accepts empty CSS", () => {
    expect(scoped("")).toEqual({ css: "", diagnostics: [] });
  });
});
