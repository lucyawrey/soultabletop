// Rolling a <Roll>'s formula: dice are rolled, everything else is computed
// like any formula, and the result keeps the expression as it was rolled
// (if() reduced to the branch it took, value() and paths to their numbers),
// so a roll's entry can show "2d20kh1 + 6" and each die. Framework-free and
// given its random source, so the server can roll with the same code later.
// See docs/sheet-system.md, "Rolls".

import {
  describeValue,
  FormulaError,
  isFormulaError,
  parseFormula,
  type DiceKeep,
  type FormulaNode,
} from "./formula";
import { evaluateFormulaNode, type FormulaEnv } from "./formula-eval";
import { conditionValue } from "./formula-functions";

export const rollLimits = {
  // Dice in one roll, all terms together.
  maxDice: 100,
  minSides: 2,
  maxSides: 1000,
};

// A whole number from 1 to `sides`.
export type RollRandom = (sides: number) => number;

// Fair rolls from the browser's (or Node's) crypto source.
export function cryptoRandom(sides: number): number {
  const limit = Math.floor(2 ** 32 / sides) * sides;
  const buffer = new Uint32Array(1);
  do globalThis.crypto.getRandomValues(buffer);
  while (buffer[0]! >= limit);
  return (buffer[0]! % sides) + 1;
}

export interface RollDie {
  sides: number;
  face: number;
  kept: boolean;
  // Set by the Roll's crit and fumble conditions on kept dice.
  mark?: "crit" | "fumble";
}

// The expression as rolled.
export type RollTerm =
  | { kind: "dice"; count: number; sides: number; keep?: DiceKeep; dice: RollDie[] }
  | { kind: "number"; value: number }
  | { kind: "op"; op: "+" | "-" | "*" | "/"; left: RollTerm; right: RollTerm }
  | { kind: "neg"; operand: RollTerm };

export interface RolledFormula {
  term: RollTerm;
  total: number;
}

const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 } as const;

// Whether a formula rolls dice (a dice literal or dice(text)).
export function formulaHasDice(node: FormulaNode): boolean {
  switch (node.type) {
    case "dice":
      return true;
    case "call":
      return node.name === "dice" || node.args.some(formulaHasDice);
    case "unary":
      return formulaHasDice(node.operand);
    case "binary":
      return formulaHasDice(node.left) || formulaHasDice(node.right);
    case "member":
      return formulaHasDice(node.target);
    default:
      return false;
  }
}

// Every die of a rolled expression, in order.
export function rollTermDice(term: RollTerm): RollDie[] {
  switch (term.kind) {
    case "dice":
      return term.dice;
    case "number":
      return [];
    case "op":
      return [...rollTermDice(term.left), ...rollTermDice(term.right)];
    case "neg":
      return rollTermDice(term.operand);
  }
}

function printNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

// The expression as rolled, as players write it: "d20 + 7", "2 × (2d6 + 4) + d8".
export function printRollTerm(term: RollTerm): string {
  return print(term, 0, false);
}

function print(term: RollTerm, parent: number, right: boolean): string {
  switch (term.kind) {
    case "dice":
      return `${term.count === 1 && !term.keep ? "" : term.count}d${term.sides}${term.keep ? `k${term.keep.mode}${term.keep.count}` : ""}`;
    case "number":
      return term.value < 0 ? `−${printNumber(-term.value)}` : printNumber(term.value);
    case "neg":
      return `−${print(term.operand, 3, false)}`;
    case "op": {
      const own = precedence[term.op];
      const symbol = term.op === "*" ? "×" : term.op === "/" ? "÷" : term.op === "-" ? "−" : "+";
      const text = `${print(term.left, own, false)} ${symbol} ${print(term.right, own, true)}`;
      // Parentheses where reading left to right would change the result.
      const needs = own < parent || (right && own === parent && parent > 0);
      return needs ? `(${text})` : text;
    }
  }
}

class Roller {
  diceCount = 0;

  constructor(
    private readonly env: FormulaEnv,
    private readonly random: RollRandom,
  ) {}

  roll(node: FormulaNode): RolledFormula | FormulaError {
    if (!formulaHasDice(node)) return this.number(node);
    switch (node.type) {
      case "dice":
        return this.dice(node.count, node.sides, node.keep);
      case "unary": {
        const operand = this.roll(node.operand);
        if (isFormulaError(operand)) return operand;
        return { term: { kind: "neg", operand: operand.term }, total: -operand.total };
      }
      case "binary": {
        const { op } = node;
        if (op !== "+" && op !== "-" && op !== "*" && op !== "/") return notHere();
        const left = this.roll(node.left);
        if (isFormulaError(left)) return left;
        const right = this.roll(node.right);
        if (isFormulaError(right)) return right;
        if (op === "/" && right.total === 0) return new FormulaError("division-by-zero", "Division by zero");
        const total =
          op === "+" ? left.total + right.total
          : op === "-" ? left.total - right.total
          : op === "*" ? left.total * right.total
          : left.total / right.total;
        return { term: { kind: "op", op, left: left.term, right: right.term }, total };
      }
      case "call":
        if (node.name === "if") {
          const condition = conditionValue("if", evaluateFormulaNode(node.args[0]!, this.env));
          if (isFormulaError(condition)) return condition;
          const branch = node.args[condition ? 1 : 2];
          return branch ? this.roll(branch) : { term: { kind: "number", value: 0 }, total: 0 };
        }
        if (node.name === "dice") return this.text(node.args[0]!);
        return notHere();
      default:
        return notHere();
    }
  }

  // A part without dice: computed like any formula. Nothing counts as 0, so
  // an empty bonus field doesn't stop the roll.
  private number(node: FormulaNode): RolledFormula | FormulaError {
    const value = evaluateFormulaNode(node, this.env);
    if (isFormulaError(value)) return value;
    if (value === null) return { term: { kind: "number", value: 0 }, total: 0 };
    if (typeof value !== "number")
      return new FormulaError("type", `A roll adds numbers, not ${describeValue(value)}`);
    return { term: { kind: "number", value }, total: value };
  }

  private dice(count: number, sides: number, keep?: DiceKeep): RolledFormula | FormulaError {
    if (sides < rollLimits.minSides || sides > rollLimits.maxSides)
      return new FormulaError("roll-limit", `Dice have ${rollLimits.minSides} to ${rollLimits.maxSides} sides, not ${sides}`);
    if (count < 1) return new FormulaError("roll-limit", "Roll at least one die");
    this.diceCount += count;
    if (this.diceCount > rollLimits.maxDice)
      return new FormulaError("roll-limit", `A roll can have at most ${rollLimits.maxDice} dice`);
    if (keep && (keep.count < 1 || keep.count > count))
      return new FormulaError("roll-limit", `Can't keep ${keep.count} of ${count} dice`);
    const dice: RollDie[] = Array.from({ length: count }, () => ({ sides, face: this.random(sides), kept: true }));
    if (keep) {
      const order = dice
        .map((die, index) => ({ die, index }))
        .sort((a, b) => (keep.mode === "h" ? b.die.face - a.die.face : a.die.face - b.die.face) || a.index - b.index);
      for (const { die } of order.slice(keep.count)) die.kept = false;
    }
    const total = dice.reduce((sum, die) => sum + (die.kept ? die.face : 0), 0);
    return { term: { kind: "dice", count, sides, ...(keep ? { keep } : {}), dice }, total };
  }

  // dice(text): the text is read as dice and numbers (no fields or functions).
  private text(arg: FormulaNode): RolledFormula | FormulaError {
    const value = evaluateFormulaNode(arg, this.env);
    if (isFormulaError(value)) return value;
    if (typeof value !== "string" || !value.trim())
      return new FormulaError("type", `dice needs text like '2d6 + 3', not ${describeValue(value)}`);
    const parsed = parseFormula(value, { line: 1, column: 1, offset: 0 });
    if (!parsed.ast || !onlyDice(parsed.ast))
      return new FormulaError("type", `"${value}" isn't dice; write it like 2d6 + 3`);
    return this.roll(parsed.ast);
  }
}

function notHere() {
  return new FormulaError("dice", "Dice can only be added, subtracted, multiplied, or divided, or picked with if()");
}

// Numbers, dice, + − × ÷, and parentheses: what dice(text) accepts.
function onlyDice(node: FormulaNode): boolean {
  switch (node.type) {
    case "number":
    case "dice":
      return true;
    case "unary":
      return node.op === "-" && onlyDice(node.operand);
    case "binary":
      return ["+", "-", "*", "/"].includes(node.op) && onlyDice(node.left) && onlyDice(node.right);
    default:
      return false;
  }
}

// Rolls a <Roll>'s formula. Never throws.
export function rollFormula(ast: FormulaNode, env: FormulaEnv, random: RollRandom): RolledFormula | FormulaError {
  try {
    const rolled = new Roller(env, random).roll(ast);
    if (isFormulaError(rolled)) return rolled;
    if (!Number.isFinite(rolled.total)) return new FormulaError("not-finite", "The result is too large to show");
    return rolled;
  } catch {
    return new FormulaError("internal", "This roll couldn't be computed");
  }
}
