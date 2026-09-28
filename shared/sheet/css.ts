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

// A selector the Sheet may not use; the message is shown to the author.
export class SheetSelectorError extends Error {}

type SelectorNode = selectorParser.Node;
type SelectorItem = selectorParser.Selector;
type SelectorChild = SelectorItem["nodes"][number];

function isRootNode(node: SelectorNode) {
  return (
    (node.type === "pseudo" && node.value.toLowerCase() === ":root") ||
    (node.type === "tag" && ["html", "body"].includes(node.value.toLowerCase()))
  );
}

function isSiblingCombinator(node: SelectorNode | undefined) {
  return node?.type === "combinator" && ["~", "+"].includes(node.value.trim());
}

// Whether `node` sits inside a pseudo-class function like :not(…) or :has(…).
function insidePseudoFunction(node: SelectorNode, item: SelectorItem) {
  for (let parent = node.parent; parent && parent !== item; parent = parent.parent) {
    if (parent.type === "pseudo") return true;
  }
  return false;
}

// The top-level compound selectors of `item`, split at combinators.
function compounds(item: SelectorItem) {
  const result: SelectorChild[][] = [[]];
  for (const node of item.nodes) {
    if (node.type === "combinator") result.push([]);
    else result.at(-1)!.push(node);
  }
  return result;
}

// Limits a selector list to the Sheet, so every selector's subject (the
// element it styles) is inside the Sheet: `.x` -> `[data-sheet="id"] .x`;
// `:root`, `html`, and `body` become the Sheet root itself, but only when they
// start the selector; a leading `.dark` (Nuxt UI's color mode class) stays
// outside. Anything that could reach outside (root selectors inside :not()
// and friends, sibling combinators off the root, a leading ~ or +) throws a
// SheetSelectorError.
export function scopeSheetSelector(selector: string, scopeId: string) {
  return selectorParser((selectors) => {
    selectors.each((item) => {
      if (isSiblingCombinator(item.first)) {
        throw new SheetSelectorError(
          `"${String(item).trim()}" can't start with ${String(item.first).trim()}`,
        );
      }

      const leading = compounds(item)[0]!;
      const roots: SelectorNode[] = [];
      item.walk((node) => {
        if (!isRootNode(node)) return;
        // Checked first: only direct children can be in `leading`.
        if (node.parent !== item || !leading.includes(node as SelectorChild)) {
          throw new SheetSelectorError(
            `${node.value} can only start a selector (it means this Sheet); "${String(item).trim()}" would reach outside the Sheet`,
          );
        }
        roots.push(node);
      });
      if (roots.length) {
        const afterLeading = item.nodes[item.nodes.indexOf(leading.at(-1)!) + 1];
        if (isSiblingCombinator(afterLeading)) {
          throw new SheetSelectorError(
            `"${String(item).trim()}" would style elements next to the Sheet, outside it`,
          );
        }
        for (const node of roots) node.replaceWith(scopeAttribute(scopeId));
        return;
      }

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

// Whether a scoped selector list styles the Sheet root itself (its last
// compound holds the scope attribute), e.g. `:root` or `.dark`.
function selectorTargetsScope(selector: string) {
  let targets = false;
  selectorParser((selectors) => {
    selectors.each((item) => {
      if (
        compounds(item)
          .at(-1)!
          .some((node) => node.type === "attribute" && node.attribute === "data-sheet")
      )
        targets = true;
    });
  }).processSync(selector);
  return targets;
}

// Checks a nested rule's selector (relative to its parent rule) and returns
// whether it, too, styles the Sheet root. `&` inside :not()/:has()/… could
// match elements outside the Sheet; a ~ or + off the root would reach its
// siblings.
function checkNestedSelector(selector: string, parentTargetsRoot: boolean) {
  let targets = false;
  selectorParser((selectors) => {
    selectors.each((item) => {
      item.walk((node) => {
        if (node.type === "nesting" && insidePseudoFunction(node, item)) {
          throw new SheetSelectorError(
            `& can't be used inside :not(), :has(), or other pseudo-classes in Sheet CSS ("${String(item).trim()}")`,
          );
        }
      });
      if (!parentTargetsRoot) return;
      const hasNesting = item.nodes.some((node) => node.type === "nesting");
      // Without a top-level &, the selector means `& <selector>`, so only a
      // leading ~ or + attaches to the root.
      if (!hasNesting && isSiblingCombinator(item.first)) {
        throw new SheetSelectorError(
          `"${String(item).trim()}" would style elements next to the Sheet, outside it`,
        );
      }
      let compoundHasNesting = false;
      item.nodes.forEach((node) => {
        if (node.type === "nesting") compoundHasNesting = true;
        if (node.type !== "combinator") return;
        if (compoundHasNesting && isSiblingCombinator(node)) {
          throw new SheetSelectorError(
            `"${String(item).trim()}" would style elements next to the Sheet, outside it`,
          );
        }
        compoundHasNesting = false;
      });
      if (compounds(item).at(-1)!.some((node) => node.type === "nesting")) targets = true;
    });
  }).processSync(selector);
  return targets;
}

// The nearest enclosing rule (through at-rules like @media), if any.
function closestRule(node: CssNode): Rule | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "rule") return parent as Rule;
  }
  return undefined;
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

  // Rules whose subject is the Sheet root itself (`:root { … }`,
  // `.dark { … }`): rules nested in them could reach the root's siblings.
  const targetsRoot = new Set<Rule>();
  // Without a scope ID (checking on save), scope with a placeholder so the
  // same rules are enforced.
  const scope = scopeId ?? "00000000-0000-4000-8000-000000000000";
  root.walkRules((rule: Rule) => {
    if (insideKeyframes(rule)) return;
    const parent = closestRule(rule);
    try {
      if (parent) {
        // Nested rules stay relative to their parent; only check them.
        if (checkNestedSelector(rule.selector, targetsRoot.has(parent)))
          targetsRoot.add(rule);
      } else {
        const scoped = scopeSheetSelector(rule.selector, scope);
        if (selectorTargetsScope(scoped)) targetsRoot.add(rule);
        if (scopeId) rule.selector = scoped;
      }
    } catch (error) {
      report(
        rule,
        "css-selector",
        error instanceof SheetSelectorError
          ? error.message
          : `Invalid selector: ${rule.selector}`,
      );
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
