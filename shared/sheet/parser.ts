// Parser for Sheet markup: HTML-like tags, attributes, text with `{path}`
// interpolation, and comments. It knows nothing about which tags exist (that's
// the validator's job) and never throws: every problem becomes a diagnostic
// with a location, and parsing carries on so the editor can show all of them.
// See docs/sheet-system.md, section 1.

import { isReservedKey, RESERVED_KEYS } from "../content-schema";
import { formulaLimits, type FormulaNode } from "./formula";

export interface Position {
  line: number; // 1-based
  column: number; // 1-based
  offset: number; // 0-based index into the source
}

export interface Loc {
  start: Position;
  end: Position;
}

// `{expr}`: a formula, as written (entities not decoded). The validator
// parses it and sets `ast` when it is valid.
export interface FormulaPart {
  formula: string;
  loc: Loc;
  // Where the expression starts, after `{`.
  bodyStart: Position;
  ast?: FormulaNode;
}

export type TextPart = string | FormulaPart;

export function isFormulaPart(part: TextPart): part is FormulaPart {
  return typeof part === "object" && "formula" in part;
}

export interface SheetAttr {
  name: string;
  // `true` for a bare attribute (`<Text multiline />`). A `formula` attribute
  // is raw text: one string part, as written.
  value: TextPart[] | true;
  loc: Loc;
  // The value without its quotes, as written, and where it is.
  raw?: string;
  valueLoc?: Loc;
}

// Attributes whose value is a bare formula, kept as written.
const rawAttributes = new Set(["formula", "show"]);

export interface SheetElement {
  type: "element";
  tag: string;
  attrs: SheetAttr[];
  children: SheetNode[];
  selfClosing: boolean;
  loc: Loc;
}

export interface SheetText {
  type: "text";
  parts: TextPart[];
  loc: Loc;
}

export type SheetNode = SheetElement | SheetText;

export interface SheetDiagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  loc: Loc;
}

export interface ParseResult {
  nodes: SheetNode[];
  diagnostics: SheetDiagnostic[];
}

export const sheetParseLimits = {
  maxSourceLength: 100_000,
  maxDepth: 32,
  maxNodes: 5_000,
};

// `.` is the current List item; `/` at the start means the top level.
const pathPattern =
  /^(?:\.|\/?[A-Za-z_][A-Za-z0-9_]*(?:\.(?:[A-Za-z_][A-Za-z0-9_]*|\d+))*)$/;

export function isValidSheetPath(path: string) {
  return pathPattern.test(path) && !usesReservedKey(path);
}

// Whether any segment of a path is a reserved key (`__proto__`, ...).
export function usesReservedKey(path: string) {
  return path.replace(/^\//, "").split(".").some(isReservedKey);
}

export interface SheetPath {
  // Starts at the top level (`/name`) instead of the current List item.
  absolute: boolean;
  // Empty for `.`, the current item itself.
  segments: string[];
}

export function parseSheetPath(path: string): SheetPath {
  const absolute = path.startsWith("/");
  const rest = absolute ? path.slice(1) : path;
  return { absolute, segments: rest === "." ? [] : rest.split(".") };
}

// The message for a path that isn't valid.
export function invalidPathMessage(path: string) {
  return usesReservedKey(path)
    ? `"${path}" uses a reserved name (${RESERVED_KEYS.join(", ")})`
    : `"${path}" isn't a valid field path; use names joined by dots, like stats.strength`;
}

const namedEntities: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: "\"",
  apos: "'",
};

const tagNamePattern = /[A-Za-z][A-Za-z0-9]*/y;
const attrNamePattern = /[A-Za-z_][A-Za-z0-9_-]*/y;
const entityPattern = /&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z]+);/y;

function isNameStart(char: string | undefined) {
  return char !== undefined && /[A-Za-z]/.test(char);
}

function isWhitespace(char: string | undefined) {
  return char !== undefined && /\s/.test(char);
}

class Parser {
  private pos = 0;
  private nodeCount = 0;
  private stopped = false;
  private readonly diagnostics: SheetDiagnostic[] = [];
  private readonly lineStarts: number[] = [0];

  constructor(private readonly src: string) {
    for (let index = 0; index < src.length; index += 1) {
      if (src[index] === "\n") this.lineStarts.push(index + 1);
    }
  }

  parse(): ParseResult {
    const { maxSourceLength } = sheetParseLimits;
    if (this.src.length > maxSourceLength) {
      this.report(
        "source-too-long",
        `Markup is ${this.src.length.toLocaleString()} characters long; the limit is ${maxSourceLength.toLocaleString()}`,
        0,
        0,
      );
      return { nodes: [], diagnostics: this.diagnostics };
    }

    const nodes: SheetNode[] = [];
    const stack: SheetElement[] = [];
    while (this.pos < this.src.length && !this.stopped) {
      const siblings = stack.at(-1)?.children ?? nodes;
      if (this.src.startsWith("<!--", this.pos)) this.comment();
      else if (this.startsCloseTag(this.pos)) this.closeTag(stack);
      else if (this.startsOpenTag(this.pos)) this.openTag(stack, siblings);
      else this.text(siblings);
    }

    if (!this.stopped) {
      for (const element of stack.toReversed()) {
        this.reportAt(
          "unclosed-element",
          `<${element.tag}> is never closed; add </${element.tag}> or write <${element.tag} />`,
          element.loc,
        );
        element.loc = { start: element.loc.start, end: this.position(this.src.length) };
      }
    }
    return { nodes, diagnostics: this.diagnostics };
  }

  // Positions

  private position(offset: number): Position {
    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (this.lineStarts[middle]! <= offset) low = middle;
      else high = middle - 1;
    }
    return { line: low + 1, column: offset - this.lineStarts[low]! + 1, offset };
  }

  private loc(start: number, end: number): Loc {
    return { start: this.position(start), end: this.position(end) };
  }

  private report(
    code: string,
    message: string,
    start: number,
    end: number,
    severity: SheetDiagnostic["severity"] = "error",
  ) {
    this.reportAt(code, message, this.loc(start, end), severity);
  }

  private reportAt(
    code: string,
    message: string,
    loc: Loc,
    severity: SheetDiagnostic["severity"] = "error",
  ) {
    this.diagnostics.push({ severity, code, message, loc });
  }

  // Limits

  private countNode(offset: number) {
    this.nodeCount += 1;
    if (this.nodeCount <= sheetParseLimits.maxNodes) return true;
    this.report(
      "too-many-nodes",
      `Markup has more than ${sheetParseLimits.maxNodes.toLocaleString()} tags and text blocks; the rest was not read`,
      offset,
      offset,
    );
    this.stopped = true;
    return false;
  }

  // Scanning helpers

  private startsOpenTag(offset: number) {
    return this.src[offset] === "<" && isNameStart(this.src[offset + 1]);
  }

  private startsCloseTag(offset: number) {
    return this.src.startsWith("</", offset) && isNameStart(this.src[offset + 2]);
  }

  private startsMarkup(offset: number) {
    return (
      this.src.startsWith("<!--", offset) ||
      this.startsOpenTag(offset) ||
      this.startsCloseTag(offset)
    );
  }

  private read(pattern: RegExp) {
    pattern.lastIndex = this.pos;
    const match = pattern.exec(this.src);
    if (!match) return "";
    this.pos += match[0].length;
    return match[0];
  }

  private skipWhitespace() {
    while (isWhitespace(this.src[this.pos])) this.pos += 1;
  }

  // Constructs

  private comment() {
    const start = this.pos;
    const end = this.src.indexOf("-->", start + 4);
    if (end === -1) {
      this.report("unterminated-comment", "Comment is never closed; end it with -->", start, start + 4);
      this.pos = this.src.length;
      return;
    }
    this.pos = end + 3;
  }

  private openTag(stack: SheetElement[], siblings: SheetNode[]) {
    const start = this.pos;
    this.pos += 1;
    const tag = this.read(tagNamePattern);
    const element: SheetElement = {
      type: "element",
      tag,
      attrs: [],
      children: [],
      selfClosing: false,
      loc: this.loc(start, start),
    };

    let terminated = false;
    while (this.pos < this.src.length) {
      this.skipWhitespace();
      const char = this.src[this.pos];
      if (char === ">") {
        this.pos += 1;
        terminated = true;
        break;
      }
      if (char === "/" && this.src[this.pos + 1] === ">") {
        this.pos += 2;
        element.selfClosing = true;
        terminated = true;
        break;
      }
      if (char === "<" || char === undefined) break;
      this.attribute(element);
    }
    element.loc = this.loc(start, this.pos);
    if (!terminated) {
      this.reportAt("unterminated-tag", `<${tag}> is missing its closing ">"`, element.loc);
    }

    if (!this.countNode(start)) return;
    if (!element.selfClosing && stack.length >= sheetParseLimits.maxDepth) {
      this.reportAt(
        "too-deep",
        `Tags are nested more than ${sheetParseLimits.maxDepth} levels deep; the rest was not read`,
        element.loc,
      );
      this.stopped = true;
      return;
    }
    siblings.push(element);
    if (!element.selfClosing) stack.push(element);
  }

  private attribute(element: SheetElement) {
    const start = this.pos;
    const name = this.read(attrNamePattern);
    if (!name) {
      const char = this.src[this.pos]!;
      this.report(
        "unexpected-character",
        `Unexpected "${char}" in <${element.tag}>; attributes look like name="value"`,
        this.pos,
        this.pos + 1,
      );
      this.pos += 1;
      return;
    }

    let value: SheetAttr["value"] = true;
    let raw: Pick<SheetAttr, "raw" | "valueLoc"> = {};
    const afterName = this.pos;
    this.skipWhitespace();
    if (this.src[this.pos] === "=") {
      this.pos += 1;
      this.skipWhitespace();
      const result = this.attributeValue(name);
      value = result.value;
      raw = { raw: this.src.slice(result.start, result.end), valueLoc: this.loc(result.start, result.end) };
    } else {
      this.pos = afterName;
    }

    const loc = this.loc(start, this.pos);
    const lowerName = name.toLowerCase();
    if (element.attrs.some((attr) => attr.name.toLowerCase() === lowerName)) {
      this.reportAt("duplicate-attribute", `${name} is set more than once on <${element.tag}>`, loc);
      return;
    }
    element.attrs.push({ name, value, loc, ...raw });
  }

  // The value of attribute `name` and where it is (without its quotes).
  private attributeValue(name: string): { value: TextPart[]; start: number; end: number } {
    const isRaw = rawAttributes.has(name.toLowerCase());
    const read = (start: number, end: number) => ({
      value: isRaw ? [this.src.slice(start, end)] : this.parts(start, end, false),
      start,
      end,
    });
    const quote = this.src[this.pos];
    if (quote === "\"" || quote === "'") {
      const valueStart = this.pos + 1;
      const close = this.src.indexOf(quote, valueStart);
      if (close !== -1) {
        this.pos = close + 1;
        const after = this.src[this.pos];
        const cutShort = after !== undefined && !isWhitespace(after) && after !== ">" && after !== "/";
        const value = this.src.slice(valueStart, close);
        const openFormula = value.lastIndexOf("{");
        if (!isRaw && cutShort && openFormula !== -1 && !value.includes("}", openFormula)) {
          this.report(
            "formula-syntax",
            `The formula ends at this ${quote}; inside ${name}=${quote}…${quote}, write text in ${quote === "\"" ? "single quotes, like 'expert'" : "double quotes, like \"expert\""}`,
            close,
            close + 1,
          );
        }
        if (isRaw && cutShort) {
          this.report(
            "formula-syntax",
            `The formula ends at this ${quote}; inside ${name}=${quote}…${quote}, write text in ${quote === "\"" ? "single quotes, like 'expert'" : "double quotes, like \"expert\""}`,
            close,
            close + 1,
          );
        }
        return read(valueStart, close);
      }
      // Unterminated: assume the value ends at the tag's ">".
      const tagEnd = this.src.indexOf(">", valueStart);
      const end = tagEnd === -1 ? this.src.length : tagEnd;
      this.report(
        "unterminated-attribute",
        `The value of ${name} is missing its closing ${quote}`,
        this.pos,
        end,
      );
      this.pos = end;
      return read(valueStart, end);
    }

    const valueStart = this.pos;
    while (
      this.pos < this.src.length &&
      !isWhitespace(this.src[this.pos]) &&
      this.src[this.pos] !== ">" &&
      !this.src.startsWith("/>", this.pos)
    ) {
      this.pos += 1;
    }
    if (this.pos === valueStart) {
      this.report("missing-attribute-value", `${name}= needs a value in quotes`, valueStart, valueStart);
      return { value: [], start: valueStart, end: valueStart };
    }
    this.report(
      "unquoted-attribute",
      `Put the value of ${name} in quotes: ${name}="${this.src.slice(valueStart, this.pos)}"`,
      valueStart,
      this.pos,
    );
    return read(valueStart, this.pos);
  }

  private closeTag(stack: SheetElement[]) {
    const start = this.pos;
    this.pos += 2;
    const tag = this.read(tagNamePattern);
    this.skipWhitespace();
    if (this.src[this.pos] === ">") {
      this.pos += 1;
    } else {
      this.report("unterminated-tag", `</${tag}> is missing its closing ">"`, start, this.pos);
    }
    const end = this.pos;

    const lowerTag = tag.toLowerCase();
    const index = stack.findLastIndex((element) => element.tag.toLowerCase() === lowerTag);
    if (index === -1) {
      this.report("unexpected-close-tag", `</${tag}> doesn't match any open tag`, start, end);
      return;
    }

    // Anything opened after the matching tag was never closed.
    for (const element of stack.slice(index + 1).toReversed()) {
      this.reportAt(
        "unclosed-element",
        `<${element.tag}> is never closed; add </${element.tag}> before </${tag}> or write <${element.tag} />`,
        element.loc,
      );
      element.loc = { start: element.loc.start, end: this.position(start) };
    }
    const element = stack[index]!;
    element.loc = { start: element.loc.start, end: this.position(end) };
    stack.length = index;
  }

  private text(siblings: SheetNode[]) {
    const start = this.pos;
    let end = start;
    while (end < this.src.length && !this.startsMarkup(end)) {
      const char = this.src[end];
      if (char === "\\" && end + 1 < this.src.length && "{}\\".includes(this.src[end + 1]!)) {
        end += 2;
        continue;
      }
      // A formula may contain < and quoted }; skip to its end.
      if (char === "{") {
        const close = this.formulaEnd(end + 2, this.src.length);
        if (close !== -1) {
          end = close + 1;
          continue;
        }
      }
      if (char === "<") {
        this.report("stray-less-than", "Write &lt; for a literal <", end, end + 1);
      }
      end += 1;
    }
    this.pos = end;

    const parts = this.parts(start, end, true);
    if (!parts.length || !this.countNode(start)) return;
    siblings.push({ type: "text", parts, loc: this.loc(start, end) });
  }

  // The `}` that ends a formula starting at `from` (after `{`), skipping
  // quoted text in it; -1 if there is none before `end`. The search stops
  // after the longest formula allowed (so markup can't make parsing
  // quadratic) and at a closing tag (an unclosed `{` doesn't swallow the
  // tags after it).
  private formulaEnd(from: number, end: number) {
    end = Math.min(end, from + formulaLimits.maxLength + 1);
    let index = from;
    while (index < end) {
      const char = this.src[index]!;
      if (char === "}") return index;
      if (char === "<" && this.src[index + 1] === "/" && isNameStart(this.src[index + 2])) return -1;
      if (char === "'" || char === "\"") {
        index += 1;
        while (index < end && this.src[index] !== char) {
          index += this.src[index] === "\\" ? 2 : 1;
        }
      }
      index += 1;
    }
    return -1;
  }

  // Text and attribute values: entities, `\{` `\}` `\\` escapes, and
  // `{expr}` formulas. Text collapses whitespace like
  // HTML and is trimmed.
  private parts(start: number, end: number, collapse: boolean): TextPart[] {
    const parts: TextPart[] = [];
    let buffer = "";
    const flush = () => {
      if (buffer) parts.push(buffer);
      buffer = "";
    };

    let index = start;
    while (index < end) {
      const char = this.src[index]!;
      const next = this.src[index + 1];

      if (char === "\\" && index + 1 < end && (next === "{" || next === "}" || next === "\\")) {
        buffer += next;
        index += 2;
        continue;
      }

      if (char === "&") {
        entityPattern.lastIndex = index;
        const match = entityPattern.exec(this.src);
        if (match && index + match[0].length <= end) {
          const decoded = this.decodeEntity(match[1]!);
          if (decoded === undefined) {
            this.report(
              "unknown-entity",
              `Unknown entity ${match[0]}; use &amp; for a literal &`,
              index,
              index + match[0].length,
              "warning",
            );
            buffer += match[0];
          } else {
            buffer += decoded;
          }
          index += match[0].length;
          continue;
        }
      }

      if (char === "{") {
        const close = this.formulaEnd(index + 1, end);
        if (close === -1) {
          this.report(
            "unterminated-formula",
            `{ starts a formula but has no closing } (within ${formulaLimits.maxLength.toLocaleString("en-US")} characters); write \\{ for a literal {`,
            index,
            index + 1,
          );
          buffer += this.src.slice(index, end);
          index = end;
          continue;
        }
        const formula = this.src.slice(index + 1, close);
        if (!formula.trim()) {
          this.report("empty-formula", "{} needs a formula, like {hitPoints}", index, close + 1);
        } else if (/^\s*=(?!=)/.test(formula)) {
          this.report(
            "formula-syntax",
            "Write {…} without the =: every {…} is a formula",
            index,
            close + 1,
          );
        } else {
          flush();
          parts.push({
            formula,
            loc: this.loc(index, close + 1),
            bodyStart: this.position(index + 1),
          });
        }
        index = close + 1;
        continue;
      }

      buffer += char;
      index += 1;
    }
    flush();

    if (!collapse) return parts;
    const collapsed = parts.map((part) =>
      typeof part === "string" ? part.replace(/\s+/g, " ") : part,
    );
    if (typeof collapsed[0] === "string") collapsed[0] = collapsed[0].trimStart();
    const last = collapsed.length - 1;
    if (typeof collapsed[last] === "string") collapsed[last] = collapsed[last].trimEnd();
    return collapsed.filter((part) => part !== "");
  }

  private decodeEntity(body: string) {
    if (body.startsWith("#")) {
      const codePoint =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : undefined;
    }
    return namedEntities[body];
  }
}

export function parseSheetMarkup(source: string): ParseResult {
  return new Parser(source).parse();
}
