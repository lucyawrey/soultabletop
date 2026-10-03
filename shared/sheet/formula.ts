// Sheet formulas: the lexer and parser. A formula is a small expression
// language (no JavaScript, no `eval`): arithmetic, comparisons, `and`/`or`/
// `not`, field paths, and calls to built-in functions or the sheet's own
// `<Define>`s. Values are computed when a sheet is shown and never stored.
// See docs/sheet-system.md, "Formulas". Framework-free: the validator, the
// renderer, and the editor all use this file.

import { isReservedKey, RESERVED_KEYS } from "../content-schema";
import type { Loc, Position, SheetDiagnostic, SheetPath } from "./parser";

export const formulaLimits = {
  // Characters of one expression.
  maxLength: 1_000,
  maxNodes: 200,
  // Nesting of parentheses, operators, and calls.
  maxDepth: 32,
  maxArgs: 32,
  maxDefinitions: 200,
  maxParams: 8,
  // Formulas (attributes, `{= }` parts, and `show`) in one sheet.
  maxSites: 2_000,
  // Per-item arguments inside per-item arguments (`sum(a, sum(b, x))` is 2).
  maxItemNesting: 2,
  // Node visits and aggregate items in one evaluation.
  maxSteps: 20_000,
  // Steps for all of a sheet's formulas together, split evenly between them:
  // each gets the smaller of maxSteps and this divided by the formula count,
  // so a sheet with many formulas can't take seconds to show (measured: about
  // 70 ns a step, so 2,000,000 steps is roughly 150 ms).
  maxSheetSteps: 2_000_000,
  // Definitions calling definitions.
  maxCallDepth: 16,
  maxStringLength: 10_000,
};

// `and`, `or`, `not`, and the literals. A field with one of these names is
// reached as `/and` or `.and`.
export const formulaReservedWords: readonly string[] = [
  "and",
  "or",
  "not",
  "true",
  "false",
  "null",
];

export type FormulaBinaryOp =
  | "or"
  | "and"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "+"
  | "-"
  | "*"
  | "/"
  | "%";

export type FormulaNode =
  | { type: "number"; value: number; loc: Loc }
  | { type: "string"; value: string; loc: Loc }
  | { type: "boolean"; value: boolean; loc: Loc }
  | { type: "null"; loc: Loc }
  | { type: "path"; path: SheetPath; text: string; loc: Loc }
  | { type: "param"; name: string; loc: Loc }
  | { type: "unary"; op: "-" | "not"; operand: FormulaNode; loc: Loc }
  | {
      type: "binary";
      op: FormulaBinaryOp;
      left: FormulaNode;
      right: FormulaNode;
      loc: Loc;
    }
  | { type: "call"; name: string; args: FormulaNode[]; nameLoc: Loc; loc: Loc }
  | { type: "dice"; count: number; sides: number; loc: Loc };

export interface FormulaParseOptions {
  // Inside a `<Define>`: bare words with these names are its parameters.
  params?: readonly string[];
}

export interface FormulaParseResult {
  ast?: FormulaNode;
  diagnostics: SheetDiagnostic[];
}

// Tokens

type TokenType =
  | "number"
  | "string"
  | "word" // a bare identifier: a path, a call name, or a parameter
  | "keyword"
  | "path" // anything else path-like: dotted, `/`-rooted, `.`-relative
  | "dice"
  | "op"
  | "("
  | ")"
  | ","
  | "end";

interface Token {
  type: TokenType;
  text: string;
  value?: number | string;
  dice?: { count: number; sides: number };
  start: number; // index into the decoded characters
  end: number;
}

class FormulaSyntaxError extends Error {
  constructor(
    message: string,
    readonly start: number,
    readonly end: number,
    readonly code = "formula-syntax",
  ) {
    super(message);
  }
}

const entities: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: "\"",
  apos: "'",
};

const identStart = /[A-Za-z_]/;
const identChar = /[A-Za-z0-9_]/;
const digit = /[0-9]/;

function isIdentStart(char: string | undefined) {
  return char !== undefined && identStart.test(char);
}

function isIdentChar(char: string | undefined) {
  return char !== undefined && identChar.test(char);
}

function isDigit(char: string | undefined) {
  return char !== undefined && digit.test(char);
}

// The source decoded (entities resolved), with the source position of each
// decoded character, so diagnostics point at the markup as written.
function decode(source: string, start: Position) {
  const chars: string[] = [];
  const positions: Position[] = [];
  let line = start.line;
  let column = start.column;
  let offset = start.offset;
  const advance = (text: string) => {
    for (const char of text) {
      if (char === "\n") {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
      offset += char.length;
    }
  };
  let index = 0;
  while (index < source.length) {
    const position = { line, column, offset };
    if (source[index] === "&") {
      const match = /^&([a-z]+);/.exec(source.slice(index, index + 8));
      const decoded = match ? entities[match[1]!] : undefined;
      if (match && decoded) {
        chars.push(decoded);
        positions.push(position);
        advance(match[0]);
        index += match[0].length;
        continue;
      }
    }
    const char = source[index]!;
    chars.push(char);
    positions.push(position);
    advance(char);
    index += 1;
  }
  positions.push({ line, column, offset });
  return { chars, positions };
}

class Lexer {
  private index = 0;
  private previous: Token | undefined;

  constructor(private readonly chars: string[]) {}

  private peek(ahead = 0) {
    return this.chars[this.index + ahead];
  }

  // After an operand, `/` divides; before one, `/name` is a path from the top.
  private afterOperand() {
    const type = this.previous?.type;
    return (
      type === "number" ||
      type === "string" ||
      type === "word" ||
      type === "path" ||
      type === "dice" ||
      type === ")" ||
      (type === "keyword" &&
        ["true", "false", "null"].includes(this.previous!.text))
    );
  }

  next(): Token {
    const token = this.read();
    this.previous = token;
    return token;
  }

  private make(type: TokenType, start: number, extra: Partial<Token> = {}): Token {
    return {
      type,
      text: this.chars.slice(start, this.index).join(""),
      start,
      end: this.index,
      ...extra,
    };
  }

  private read(): Token {
    while (this.peek() !== undefined && /\s/.test(this.peek()!)) this.index += 1;
    const start = this.index;
    const char = this.peek();
    if (char === undefined) return this.make("end", start);

    if (isDigit(char)) return this.number(start);
    if (char === "'" || char === "\"") return this.string(start, char);
    if (isIdentStart(char)) return this.word(start);

    if (char === ".") {
      if (isIdentStart(this.peek(1))) {
        this.index += 1;
        return this.path(start);
      }
      if (isDigit(this.peek(1))) {
        throw new FormulaSyntaxError(
          "A number can't start with a dot; write 0.5 instead of .5",
          start,
          start + 2,
        );
      }
      this.index += 1;
      return this.make("path", start, { value: "." });
    }

    if (char === "/" && !this.afterOperand()) {
      if (!isIdentStart(this.peek(1))) {
        throw new FormulaSyntaxError(
          "/ needs a field name after it, like /level",
          start,
          start + 1,
        );
      }
      this.index += 1;
      return this.path(start);
    }

    const two = char + (this.peek(1) ?? "");
    if (["==", "!=", "<=", ">="].includes(two)) {
      this.index += 2;
      return this.make("op", start);
    }
    if (two === "&&" || two === "||") {
      this.index += 2;
      throw new FormulaSyntaxError(
        `Use ${two === "&&" ? "and" : "or"} instead of ${two}`,
        start,
        this.index,
      );
    }
    if ("+-*/%<>".includes(char)) {
      this.index += 1;
      return this.make("op", start);
    }
    if (char === "(" || char === ")" || char === ",") {
      this.index += 1;
      return this.make(char, start);
    }
    if (char === "=") {
      throw new FormulaSyntaxError("Use == to compare values", start, start + 1);
    }
    if (char === "!") {
      throw new FormulaSyntaxError("Use not instead of !", start, start + 1);
    }
    if (char === "{" || char === "}") {
      throw new FormulaSyntaxError(
        `Unexpected "${char}"; inside a formula, refer to fields by name, like level, without braces`,
        start,
        start + 1,
      );
    }
    throw new FormulaSyntaxError(`Unexpected "${char}"`, start, start + 1);
  }

  private digits() {
    while (isDigit(this.peek())) this.index += 1;
  }

  private number(start: number): Token {
    this.digits();
    // `2d6`: a dice token, never 2 followed by d6.
    if (this.peek() === "d" && isDigit(this.peek(1))) {
      const count = Number(this.chars.slice(start, this.index).join(""));
      return this.dice(start, count);
    }
    if (this.peek() === "." && isDigit(this.peek(1))) {
      this.index += 1;
      this.digits();
    } else if (this.peek() === ".") {
      throw new FormulaSyntaxError(
        "A number needs digits after its dot, like 1.5",
        start,
        this.index + 1,
      );
    }
    if (isIdentChar(this.peek())) {
      while (isIdentChar(this.peek())) this.index += 1;
      throw new FormulaSyntaxError(
        `"${this.chars.slice(start, this.index).join("")}" isn't a number or a field name; field names can't start with a digit`,
        start,
        this.index,
      );
    }
    const text = this.chars.slice(start, this.index).join("");
    const value = Number(text);
    if (!Number.isFinite(value)) {
      throw new FormulaSyntaxError("This number is too large", start, this.index);
    }
    return this.make("number", start, { value });
  }

  private dice(start: number, count: number): Token {
    this.index += 1; // d
    const sidesStart = this.index;
    this.digits();
    const sides = Number(this.chars.slice(sidesStart, this.index).join(""));
    if (isIdentChar(this.peek()) || this.peek() === ".") {
      while (isIdentChar(this.peek())) this.index += 1;
      throw new FormulaSyntaxError(
        `"${this.chars.slice(start, this.index).join("")}" looks like dice but isn't; dice look like 2d6`,
        start,
        this.index,
      );
    }
    return this.make("dice", start, { dice: { count, sides } });
  }

  private string(start: number, quote: string): Token {
    this.index += 1;
    let value = "";
    for (;;) {
      const char = this.peek();
      if (char === undefined) {
        throw new FormulaSyntaxError(
          `Text is missing its closing ${quote}`,
          start,
          this.index,
        );
      }
      this.index += 1;
      if (char === quote) break;
      if (char === "\\") {
        const next = this.peek();
        if (next === "'" || next === "\"" || next === "\\") {
          value += next;
          this.index += 1;
          continue;
        }
        throw new FormulaSyntaxError(
          "Use \\\\ for a backslash in text; only \\', \\\", and \\\\ are escapes",
          this.index - 1,
          this.index + (next === undefined ? 0 : 1),
        );
      }
      value += char;
    }
    return this.make("string", start, { value });
  }

  private identifier() {
    const start = this.index;
    while (isIdentChar(this.peek())) this.index += 1;
    return this.chars.slice(start, this.index).join("");
  }

  private word(start: number): Token {
    // `d6`: a dice token.
    if (this.peek() === "d" && isDigit(this.peek(1))) {
      let end = this.index + 1;
      while (isDigit(this.chars[end])) end += 1;
      if (!isIdentChar(this.chars[end])) return this.dice(start, 1);
    }
    const name = this.identifier();
    if (this.peek() === "." && (isIdentStart(this.peek(1)) || isDigit(this.peek(1)))) {
      this.index = start;
      return this.path(start);
    }
    if (formulaReservedWords.includes(name)) return this.make("keyword", start);
    if (isReservedKey(name)) throw this.reservedKey(name, start);
    return this.make("word", start, { value: name });
  }

  private reservedKey(path: string, start: number) {
    return new FormulaSyntaxError(
      `"${path}" uses a reserved name (${RESERVED_KEYS.join(", ")})`,
      start,
      this.index,
    );
  }

  // A path after its `/` or `.` prefix (if any): names and indexes joined by
  // dots.
  private path(start: number): Token {
    const segments: string[] = [];
    for (;;) {
      const segmentStart = this.index;
      if (segments.length && isDigit(this.peek())) this.digits();
      else if (isIdentStart(this.peek())) this.identifier();
      else {
        throw new FormulaSyntaxError(
          "A path needs a field name after each dot, like stats.strength",
          segmentStart,
          segmentStart + 1,
        );
      }
      if (isIdentChar(this.peek())) {
        while (isIdentChar(this.peek())) this.index += 1;
        throw new FormulaSyntaxError(
          "Field names can't start with a digit",
          segmentStart,
          this.index,
        );
      }
      segments.push(this.chars.slice(segmentStart, this.index).join(""));
      if (this.peek() !== "." || !(isIdentChar(this.peek(1)))) break;
      this.index += 1;
    }
    const text = this.chars.slice(start, this.index).join("");
    if (segments.some(isReservedKey)) throw this.reservedKey(text, start);
    return this.make("path", start, { value: text });
  }
}

// Binding powers, low to high.
const binaryPower: Record<FormulaBinaryOp, number> = {
  or: 1,
  and: 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};
const unaryPower = 7;
const relational = new Set(["<", "<=", ">", ">="]);

function parsePathText(text: string): SheetPath {
  if (text === ".") return { absolute: false, segments: [] };
  if (text.startsWith("/")) return { absolute: true, segments: text.slice(1).split(".") };
  if (text.startsWith(".")) return { absolute: false, segments: text.slice(1).split(".") };
  return { absolute: false, segments: text.split(".") };
}

class FormulaParser {
  private token: Token;
  private nodes = 0;
  private readonly lexer: Lexer;

  constructor(
    private readonly chars: string[],
    private readonly positions: Position[],
    private readonly params: readonly string[],
  ) {
    this.lexer = new Lexer(chars);
    this.token = this.lexer.next();
  }

  loc(start: number, end: number): Loc {
    return { start: this.positions[start]!, end: this.positions[end]! };
  }

  private at(type: TokenType) {
    return this.token.type === type;
  }

  private advance() {
    const token = this.token;
    this.token = this.lexer.next();
    return token;
  }

  private node<T extends FormulaNode>(node: T): T {
    this.nodes += 1;
    if (this.nodes > formulaLimits.maxNodes) {
      throw new FormulaSyntaxError(
        `This formula has more than ${formulaLimits.maxNodes} parts; split it with <Define>`,
        0,
        this.chars.length,
        "formula-too-large",
      );
    }
    return node;
  }

  private describe(token: Token) {
    return token.type === "end" ? "the end of the formula" : `"${token.text}"`;
  }

  private unexpected(token: Token, expected?: string): never {
    throw new FormulaSyntaxError(
      `Unexpected ${this.describe(token)}${expected ? `; expected ${expected}` : ""}`,
      token.start,
      Math.max(token.end, token.start + 1),
    );
  }

  parse(): FormulaNode {
    if (this.at("end")) {
      throw new FormulaSyntaxError("The formula is empty", 0, 0);
    }
    const ast = this.expression(0, 0);
    if (!this.at("end")) {
      this.unexpected(this.token, "an operator like + or and");
    }
    return ast;
  }

  private opOf(token: Token): FormulaBinaryOp | undefined {
    if (token.type === "op" && token.text in binaryPower) return token.text as FormulaBinaryOp;
    if (token.type === "keyword" && (token.text === "and" || token.text === "or"))
      return token.text;
    return undefined;
  }

  private expression(minPower: number, depth: number): FormulaNode {
    if (depth > formulaLimits.maxDepth) {
      throw new FormulaSyntaxError(
        `This formula is nested more than ${formulaLimits.maxDepth} levels deep`,
        this.token.start,
        this.token.end,
        "formula-too-large",
      );
    }
    let left = this.prefix(depth);
    for (;;) {
      const op = this.opOf(this.token);
      if (!op) return left;
      const power = binaryPower[op];
      if (power <= minPower) return left;
      this.advance();
      const right = this.expression(power, depth + 1);
      if (relational.has(op) && this.opOf(this.token) && relational.has(this.opOf(this.token)!)) {
        throw new FormulaSyntaxError(
          "Comparisons can't be chained; join them with and, like a < b and b < c",
          this.token.start,
          this.token.end,
        );
      }
      left = this.node({
        type: "binary",
        op,
        left,
        right,
        loc: { start: left.loc.start, end: right.loc.end },
      });
    }
  }

  private prefix(depth: number): FormulaNode {
    const token = this.advance();
    const loc = this.loc(token.start, token.end);
    switch (token.type) {
      case "number":
        return this.node({ type: "number", value: token.value as number, loc });
      case "string":
        return this.node({ type: "string", value: token.value as string, loc });
      case "dice":
        return this.node({ type: "dice", ...token.dice!, loc });
      case "keyword":
        if (token.text === "true" || token.text === "false")
          return this.node({ type: "boolean", value: token.text === "true", loc });
        if (token.text === "null") return this.node({ type: "null", loc });
        if (token.text === "not") return this.unary("not", token, depth);
        return this.unexpected(token, "a value");
      case "op":
        if (token.text === "-") return this.unary("-", token, depth);
        if (token.text === "+") {
          throw new FormulaSyntaxError("Write the number without a + sign", token.start, token.end);
        }
        return this.unexpected(token, "a value");
      case "(": {
        const inner = this.expression(0, depth + 1);
        if (!this.at(")")) this.unexpected(this.token, "\")\"");
        this.advance();
        return inner;
      }
      case "word": {
        const name = token.value as string;
        if (this.at("(")) return this.call(name, token, depth);
        if (this.params.includes(name)) return this.node({ type: "param", name, loc });
        return this.node({ type: "path", path: parsePathText(name), text: name, loc });
      }
      case "path": {
        if (this.at("(")) {
          throw new FormulaSyntaxError(
            `"${token.text}" isn't a function name; functions are called by a plain name, like floor(x)`,
            token.start,
            this.token.end,
          );
        }
        const text = token.value as string;
        return this.node({ type: "path", path: parsePathText(text), text, loc });
      }
      default:
        return this.unexpected(token, "a value");
    }
  }

  private unary(op: "-" | "not", token: Token, depth: number): FormulaNode {
    const operand = this.expression(unaryPower - 1, depth + 1);
    return this.node({
      type: "unary",
      op,
      operand,
      loc: { start: this.positions[token.start]!, end: operand.loc.end },
    });
  }

  private call(name: string, nameToken: Token, depth: number): FormulaNode {
    this.advance(); // (
    const args: FormulaNode[] = [];
    if (!this.at(")")) {
      for (;;) {
        if (args.length >= formulaLimits.maxArgs) {
          throw new FormulaSyntaxError(
            `A call can have at most ${formulaLimits.maxArgs} arguments`,
            this.token.start,
            this.token.end,
            "formula-too-large",
          );
        }
        args.push(this.expression(0, depth + 1));
        if (this.at(",")) {
          this.advance();
          continue;
        }
        if (this.at(")")) break;
        this.unexpected(this.token, "\",\" or \")\"");
      }
    }
    const close = this.advance();
    return this.node({
      type: "call",
      name,
      args,
      nameLoc: this.loc(nameToken.start, nameToken.end),
      loc: this.loc(nameToken.start, close.end),
    });
  }
}

// Parses one expression. `start` is where `source` begins in the markup, so
// positions in diagnostics and on nodes are the markup's; `source` is the text
// as written (entities like &lt; are decoded here).
export function parseFormula(
  source: string,
  start: Position,
  options: FormulaParseOptions = {},
): FormulaParseResult {
  const { chars, positions } = decode(source, start);
  const locOf = (from: number, to: number): Loc => ({
    start: positions[Math.min(from, chars.length)]!,
    end: positions[Math.min(to, chars.length)]!,
  });
  if (source.length > formulaLimits.maxLength) {
    return {
      diagnostics: [
        {
          severity: "error",
          code: "formula-too-large",
          message: `This formula is ${source.length.toLocaleString("en-US")} characters long; the limit is ${formulaLimits.maxLength.toLocaleString("en-US")}. Split it with <Define>`,
          loc: locOf(0, chars.length),
        },
      ],
    };
  }
  try {
    const parser = new FormulaParser(chars, positions, options.params ?? []);
    return { ast: parser.parse(), diagnostics: [] };
  } catch (error) {
    if (!(error instanceof FormulaSyntaxError)) throw error;
    return {
      diagnostics: [
        {
          severity: "error",
          code: error.code,
          message: error.message,
          loc: locOf(error.start, error.end),
        },
      ],
    };
  }
}

export interface FormulaToken {
  type: "number" | "string" | "word" | "keyword" | "path" | "dice" | "op" | "punctuation";
  text: string;
  // Offsets into the source as written (entities count as written).
  from: number;
  to: number;
}

// The tokens of a formula, for editor highlighting: as many as can be read
// (it stops at the first problem instead of reporting it).
export function lexFormula(source: string): FormulaToken[] {
  const { chars, positions } = decode(source.slice(0, formulaLimits.maxLength), {
    line: 1,
    column: 1,
    offset: 0,
  });
  const lexer = new Lexer(chars);
  const tokens: FormulaToken[] = [];
  try {
    for (;;) {
      const token = lexer.next();
      if (token.type === "end") break;
      tokens.push({
        type:
          token.type === "(" || token.type === ")" || token.type === ","
            ? "punctuation"
            : token.type,
        text: token.text,
        from: positions[token.start]!.offset,
        to: positions[token.end]!.offset,
      });
    }
  } catch (error) {
    if (!(error instanceof FormulaSyntaxError)) throw error;
  }
  return tokens;
}

// Printing (for tests and tooling): fully parenthesized, so printing and
// parsing again gives the same tree.

function printNumber(value: number) {
  const text = String(value);
  if (!text.includes("e")) return text;
  if (Number.isInteger(value)) return BigInt(value).toString();
  return value.toFixed(100).replace(/0+$/, "").replace(/\.$/, "");
}

export function printFormula(node: FormulaNode): string {
  switch (node.type) {
    case "number":
      return printNumber(node.value);
    case "string":
      return `'${node.value.replace(/[\\']/g, (char) => `\\${char}`)}'`;
    case "boolean":
      return String(node.value);
    case "null":
      return "null";
    case "path":
      return node.text;
    case "param":
      return node.name;
    case "unary":
      return node.op === "not"
        ? `(not ${printFormula(node.operand)})`
        : `(-${printFormula(node.operand)})`;
    case "binary":
      return `(${printFormula(node.left)} ${node.op} ${printFormula(node.right)})`;
    case "call":
      return `${node.name}(${node.args.map(printFormula).join(", ")})`;
    case "dice":
      return `${printNumber(node.count)}d${printNumber(node.sides)}`;
  }
}

// Calls every node of the tree, parents first.
export function walkFormula(node: FormulaNode, visit: (node: FormulaNode) => void) {
  visit(node);
  switch (node.type) {
    case "unary":
      walkFormula(node.operand, visit);
      break;
    case "binary":
      walkFormula(node.left, visit);
      walkFormula(node.right, visit);
      break;
    case "call":
      for (const arg of node.args) walkFormula(arg, visit);
      break;
  }
}

// Values

// A failed computation: a type mismatch, division by zero, and so on. Errors
// are values: they pass through operators and calls to the result, which
// shows "—" (with the message for people who can edit the sheet).
export class FormulaError {
  constructor(
    readonly code: string,
    readonly message: string,
  ) {}
}

// Numbers are always finite. Lists and records only come from field paths
// and can't be a formula's final result.
export type FormulaValue =
  | null
  | boolean
  | number
  | string
  | readonly unknown[]
  | { readonly [key: string]: unknown }
  | FormulaError;

export function isFormulaError(value: unknown): value is FormulaError {
  return value instanceof FormulaError;
}

// Data as a formula value: missing is null.
export function toFormulaValue(value: unknown): FormulaValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "object"
  )
    return value as FormulaValue;
  return null;
}

export function describeValue(value: FormulaValue): string {
  if (value === null) return "nothing";
  if (Array.isArray(value)) return "a list";
  if (isFormulaError(value)) return "an error";
  switch (typeof value) {
    case "number":
      return "a number";
    case "string":
      return "text";
    case "boolean":
      return "true or false";
    default:
      return "a group of fields";
  }
}

// Static types, inferred by the checker (formula-check.ts).

export type FormulaBaseKind = "number" | "string" | "boolean" | "null" | "record";

export type FormulaType =
  | { kind: FormulaBaseKind }
  | { kind: "any" }
  | { kind: "array"; item: FormulaType }
  | { kind: "union"; types: FormulaType[] };

function typeKey(type: FormulaType): string {
  if (type.kind === "array") return `array<${typeKey(type.item)}>`;
  if (type.kind === "union") return type.types.map(typeKey).join("|");
  return type.kind;
}

export function typeMembers(type: FormulaType): FormulaType[] {
  return type.kind === "union" ? type.types : [type];
}

export function unionOf(...types: FormulaType[]): FormulaType {
  const members = new Map<string, FormulaType>();
  for (const type of types.flatMap(typeMembers)) {
    if (type.kind === "any") return type;
    members.set(typeKey(type), type);
  }
  const list = [...members.values()];
  if (list.length === 1) return list[0]!;
  return { kind: "union", types: list };
}

export const formulaTypes = {
  number: { kind: "number" },
  string: { kind: "string" },
  boolean: { kind: "boolean" },
  null: { kind: "null" },
  record: { kind: "record" },
  any: { kind: "any" },
} as const satisfies Record<string, FormulaType>;

export const scalarType = unionOf(
  formulaTypes.number,
  formulaTypes.string,
  formulaTypes.boolean,
  formulaTypes.null,
);

export function arrayOf(item: FormulaType): FormulaType {
  return { kind: "array", item };
}

// Whether a value of this type could be one of `kinds`. Nothing (null) and
// unknown types always could: the checker reports only what can never work.
export function couldBe(type: FormulaType, kinds: readonly (FormulaBaseKind | "array")[]) {
  return typeMembers(type).some(
    (member) => member.kind === "any" || member.kind === "null" || kinds.includes(member.kind as FormulaBaseKind),
  );
}

// The item type of a list type (any when unknown).
export function itemTypeOf(type: FormulaType): FormulaType {
  const items = typeMembers(type).flatMap((member) =>
    member.kind === "array" ? [member.item] : member.kind === "any" ? [formulaTypes.any] : [],
  );
  return items.length ? unionOf(...items) : formulaTypes.any;
}

export function describeType(type: FormulaType): string {
  switch (type.kind) {
    case "number":
      return "a number";
    case "string":
      return "text";
    case "boolean":
      return "true or false";
    case "null":
      return "nothing";
    case "record":
      return "a group of fields";
    case "any":
      return "anything";
    case "array":
      return "a list";
    case "union":
      return type.types.map(describeType).join(" or ");
  }
}
