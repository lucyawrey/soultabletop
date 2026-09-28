// Sanitizing and scoping a Sheet's own CSS. Every rule is limited to the
// Sheet's root element (`[data-sheet="<id>"]`), which also gets
// `isolation: isolate; contain: paint`, so nothing can style or cover the rest
// of the app. Anything that loads files (url(), @import, ...) is rejected.
// See docs/sheet-system.md, section 6.

import postcss, {
  CssSyntaxError,
  type AtRule,
  type Declaration,
  type Node as CssNode,
  type Root,
  type Rule,
} from "postcss";
import selectorParser from "postcss-selector-parser";
import { genericFontFamilies, sheetFonts } from "./fonts";
import type { Loc, SheetDiagnostic } from "./parser";

export const MAX_SHEET_CSS_LENGTH = 50_000;

const allowedAtRules = new Set([
  "media",
  "supports",
  "container",
  "layer",
  "keyframes",
  "-webkit-keyframes",
]);
const blockedProperties = new Set(["behavior", "-moz-binding"]);
// CSS functions that load files (or run code in old browsers).
const blockedFunctions =
  /(?:^|[^\w-])(?:url|image-set|-webkit-image-set|image|cross-fade|element|paint|expression)\s*\(/i;
const animationProperty = /(?:^|-)animation(?:-name)?$/;
const sheetFontNames = new Set(sheetFonts.map((font) => font.name.toLowerCase()));

// Decodes CSS escapes (`\75 rl(`) so they can't hide blocked functions.
function decodeEscapes(value: string) {
  return value
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    })
    .replace(/\\(.)/g, "$1");
}

function nodeLoc(node: CssNode): Loc {
  const start = node.source?.start;
  const end = node.source?.end ?? start;
  const position = (point: typeof start) => ({
    line: point?.line ?? 1,
    column: point?.column ?? 1,
    offset: point?.offset ?? 0,
  });
  return { start: position(start), end: position(end) };
}

// IDs can start with a digit, which isn't a valid unquoted identifier, so the
// value is always quoted (the `quoteMark` option alone doesn't do it).
function scopeAttribute(scopeId: string) {
  return selectorParser.attribute({
    attribute: "data-sheet",
    operator: "=",
    value: scopeId,
    quoteMark: "\"",
    raws: { value: `"${scopeId}"` },
  });
}

// Limits a selector list to the Sheet: `.x` -> `[data-sheet="id"] .x`;
// `:root`, `html`, and `body` become the Sheet root itself; a leading `.dark`
// (Nuxt UI's color mode class) stays outside.
export function scopeSheetSelector(selector: string, scopeId: string) {
  return selectorParser((selectors) => {
    selectors.each((item) => {
      let replacedRoot = false;
      item.walk((node) => {
        const isRoot =
          (node.type === "pseudo" && node.value.toLowerCase() === ":root") ||
          (node.type === "tag" && ["html", "body"].includes(node.value.toLowerCase()));
        if (isRoot) {
          node.replaceWith(scopeAttribute(scopeId));
          replacedRoot = true;
        }
      });
      if (replacedRoot) return;

      const [first, second] = item.nodes;
      const leadingDark =
        first?.type === "class" &&
        first.value === "dark" &&
        (!second || second.type === "combinator");
      const scope = [
        scopeAttribute(scopeId),
        selectorParser.combinator({ value: " " }),
      ];
      if (leadingDark && second) {
        // `.dark .x` -> `.dark [data-sheet] .x`
        item.insertAfter(second, scope[0]!);
        item.insertAfter(scope[0]!, scope[1]!);
      } else if (leadingDark) {
        // `.dark` alone -> `.dark [data-sheet]`
        item.insertAfter(first, selectorParser.combinator({ value: " " }));
        item.append(scopeAttribute(scopeId));
      } else {
        // Keep the space after a comma in front of the new attribute.
        if (first) {
          scope[0]!.spaces.before = first.spaces.before;
          first.spaces.before = "";
        }
        item.prepend(scope[1]!);
        item.prepend(scope[0]!);
      }
    });
  }).processSync(selector);
}

function insideKeyframes(node: CssNode) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule" && (parent as AtRule).name.toLowerCase().endsWith("keyframes"))
      return true;
  }
  return false;
}

export interface SheetCssResult {
  // Scoped CSS, or "" when not scoping or when the CSS couldn't be parsed.
  css: string;
  diagnostics: SheetDiagnostic[];
}

// Checks Sheet CSS and, given `scopeId` (the Sheet's ID), returns it scoped.
// Rejected constructs are reported as errors and dropped from the output.
export function processSheetCss(source: string, scopeId?: string): SheetCssResult {
  const diagnostics: SheetDiagnostic[] = [];
  const report = (
    node: CssNode,
    code: string,
    message: string,
    severity: SheetDiagnostic["severity"] = "error",
  ) => diagnostics.push({ severity, code, message, loc: nodeLoc(node) });

  if (source.length > MAX_SHEET_CSS_LENGTH) {
    const position = { line: 1, column: 1, offset: 0 };
    diagnostics.push({
      severity: "error",
      code: "css-too-long",
      message: `CSS is ${source.length.toLocaleString()} characters long; the limit is ${MAX_SHEET_CSS_LENGTH.toLocaleString()}`,
      loc: { start: position, end: position },
    });
    return { css: "", diagnostics };
  }

  let root: Root;
  try {
    root = postcss.parse(source);
  } catch (error) {
    if (!(error instanceof CssSyntaxError)) throw error;
    const position = {
      line: error.line ?? 1,
      column: error.column ?? 1,
      offset: 0,
    };
    diagnostics.push({
      severity: "error",
      code: "css-syntax",
      message: error.reason,
      loc: { start: position, end: position },
    });
    return { css: "", diagnostics };
  }

  // Keyframe names get a per-Sheet suffix so they can't clash with the app's
  // or other Sheets'.
  const suffix = scopeId?.replace(/[^a-z0-9]/gi, "").slice(0, 8);
  const keyframes = new Map<string, string>();
  root.walkAtRules((rule) => {
    const name = rule.name.toLowerCase();
    if (!allowedAtRules.has(name)) {
      report(rule, "css-at-rule", `@${rule.name} isn't allowed in Sheet CSS`);
      rule.remove();
      return;
    }
    if (name.endsWith("keyframes") && suffix) {
      const renamed = `${rule.params.trim()}-${suffix}`;
      keyframes.set(rule.params.trim(), renamed);
      rule.params = renamed;
    }
  });

  root.walkDecls((declaration: Declaration) => {
    const property = declaration.prop.toLowerCase();
    if (blockedProperties.has(property)) {
      report(declaration, "css-property", `${declaration.prop} isn't allowed in Sheet CSS`);
      declaration.remove();
      return;
    }
    if (blockedFunctions.test(decodeEscapes(declaration.value))) {
      report(
        declaration,
        "css-function",
        `${declaration.prop}: url() and other functions that load files aren't allowed in Sheet CSS`,
      );
      declaration.remove();
      return;
    }
    if (property === "font-family") {
      for (const family of declaration.value.split(",")) {
        const name = family.trim().replace(/^["']|["']$/g, "");
        const lower = name.toLowerCase();
        if (!name || lower.startsWith("var(") || genericFontFamilies.has(lower) || sheetFontNames.has(lower))
          continue;
        report(
          declaration,
          "css-font",
          `"${name}" isn't one of the Sheet fonts, so it only shows if the viewer has it installed`,
          "warning",
        );
      }
    }
    if (keyframes.size && animationProperty.test(property)) {
      declaration.value = declaration.value.replace(
        /[\w-]+/g,
        (token) => keyframes.get(token) ?? token,
      );
    }
  });

  root.walkRules((rule: Rule) => {
    // Keyframe steps and nested rules (relative to their parent) stay as is.
    if (insideKeyframes(rule) || rule.parent?.type === "rule") return;
    try {
      rule.selector = scopeId
        ? scopeSheetSelector(rule.selector, scopeId)
        : selectorParser().processSync(rule.selector);
    } catch {
      report(rule, "css-selector", `Invalid selector: ${rule.selector}`);
      rule.remove();
    }
  });

  // `<` can only appear in strings and comments; escaping it keeps the CSS
  // from closing its <style> element when rendered on the server.
  const css = scopeId ? root.toString().replace(/</g, "\\3c ") : "";
  // The checks above run in separate passes; report in source order.
  diagnostics.sort(
    (a, b) =>
      a.loc.start.line - b.loc.start.line ||
      a.loc.start.column - b.loc.start.column,
  );
  return { css, diagnostics };
}
