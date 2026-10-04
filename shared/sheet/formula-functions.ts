// The built-in functions of Sheet formulas, as data: arity, which arguments
// are evaluated per item of a list, static result types for the checker, the
// implementation, and the text the editor shows. See formula.ts.

import {
  arrayOf,
  couldBe,
  describeType,
  describeValue,
  formulaLimits,
  formulaReservedWords,
  formulaTypes,
  FormulaError,
  isFormulaError,
  itemTypeOf,
  toFormulaValue,
  unionOf,
  type FormulaBaseKind,
  type FormulaType,
  type FormulaValue,
} from "./formula";
import { findRef, ownProperty, refRecord, type SheetRefs } from "./scope";
import { isReservedKey } from "../content-schema";

// What a function sees of its call, for lazy and per-item functions.
export interface FormulaCallContext {
  readonly argCount: number;
  readonly refs: SheetRefs;
  // Evaluates an argument in the call's scope.
  value(index: number): FormulaValue;
  // The items of the list in argument `listIndex`, or with `exprIndex`, that
  // argument evaluated with each item as its scope. Nulls are left in.
  items(listIndex: number, exprIndex?: number): FormulaValue[] | FormulaError;
}

export interface FormulaArgCheck {
  // Reports a type problem with argument `index`.
  report(index: number, message: string): void;
}

export interface FormulaFunction {
  name: string;
  minArgs: number;
  maxArgs: number;
  // Arguments evaluated once per item of argument 0, scoped to the item.
  itemArgs?: readonly number[];
  // Arguments are evaluated by the function (only the ones it needs).
  lazy?: boolean;
  // Eager and walks list arguments: each item costs a step.
  walksLists?: boolean;
  signature: string;
  description: string;
  // Result type from the argument types.
  result(args: FormulaType[]): FormulaType;
  // Static argument checks; report only what can never work.
  check?(args: FormulaType[], problems: FormulaArgCheck): void;
  // Eager functions get evaluated arguments (errors already passed through).
  eager?(args: FormulaValue[]): FormulaValue;
  // Lazy and per-item functions evaluate their arguments themselves.
  special?(call: FormulaCallContext): FormulaValue;
}

// Helpers

function typeError(name: string, wanted: string, value: FormulaValue) {
  return new FormulaError("type", `${name} needs ${wanted}, not ${describeValue(value)}`);
}

function textTooLong() {
  return new FormulaError(
    "too-long",
    `Text from a formula can be at most ${formulaLimits.maxStringLength.toLocaleString("en-US")} characters`,
  );
}

// A finite result, or an error.
function finite(value: number): FormulaValue {
  return Number.isFinite(value)
    ? value
    : new FormulaError("not-finite", "The result is too large to show");
}

// Shows a number without floating-point noise (0.1 + 0.2 is 0.3) and without
// locale formatting, so the server and the browser show the same text.
export function formatFormulaNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toPrecision(12)));
}

function expect(
  types: FormulaType[],
  problems: FormulaArgCheck,
  name: string,
  kinds: readonly (FormulaBaseKind | "array")[],
  wanted: string,
  indexes: readonly number[] = types.map((_, index) => index),
) {
  for (const index of indexes) {
    const type = types[index];
    if (type && !couldBe(type, kinds))
      problems.report(index, `${name} needs ${wanted}, not ${describeType(type)}`);
  }
}

// One number in, one number out; nothing stays nothing.
function numeric(
  name: string,
  description: string,
  fn: (value: number) => number,
): FormulaFunction {
  return {
    name,
    minArgs: 1,
    maxArgs: 1,
    signature: `${name}(x)`,
    description,
    result: () => formulaTypes.number,
    check: (types, problems) => expect(types, problems, name, ["number"], "a number"),
    eager: ([value]) => {
      if (value === null) return null;
      if (typeof value !== "number") return typeError(name, "a number", value!);
      return finite(fn(value));
    },
  };
}

// Rounds half away from zero (2.5 → 3, -2.5 → -3). The scaled value is
// rounded to 15 significant digits first, so 1.005 rounds to 1.01.
function roundHalfAway(value: number, digits: number) {
  const scale = 10 ** digits;
  const scaled = Number((Math.abs(value) * scale).toPrecision(15));
  return (Math.sign(value) * Math.round(scaled)) / scale;
}

function extremum(name: "min" | "max"): FormulaFunction {
  const pick = name === "min" ? Math.min : Math.max;
  return {
    name,
    minArgs: 1,
    maxArgs: formulaLimits.maxArgs,
    walksLists: true,
    signature: `${name}(a, b, …) or ${name}(list)`,
    description: `The ${name === "min" ? "smallest" : "largest"} number, skipping empty values; nothing if there are none`,
    result: () => formulaTypes.number,
    check: (types, problems) => {
      if (types.length === 1) {
        const [only] = types;
        if (!couldBe(only!, ["number", "array"]))
          problems.report(0, `${name} needs numbers or a list of numbers, not ${describeType(only!)}`);
        else if (only!.kind === "array")
          expect([itemTypeOf(only!)], problems, name, ["number"], "numbers");
        return;
      }
      expect(types, problems, name, ["number"], "numbers");
    },
    eager: (args) => {
      const values =
        args.length === 1 && Array.isArray(args[0])
          ? (args[0] as unknown[]).map(toFormulaValue)
          : args;
      let result: number | null = null;
      for (const value of values) {
        if (value === null) continue;
        if (typeof value !== "number") return typeError(name, "numbers", value);
        result = result === null ? value : pick(result, value);
      }
      return result;
    },
  };
}

// Per-item list functions: `fn(list)` or `fn(list, expr)`.
function aggregate(
  name: string,
  options: {
    signature: string;
    description: string;
    result: FormulaType;
    minArgs: number;
    // What the per-item expression (or each item, without one) must be.
    itemKinds: readonly FormulaBaseKind[];
    itemWanted: string;
    // Gets every item's value, empty ones (null) included.
    reduce(values: FormulaValue[]): FormulaValue;
  },
): FormulaFunction {
  return {
    name,
    minArgs: options.minArgs,
    maxArgs: 2,
    itemArgs: [1],
    signature: options.signature,
    description: options.description,
    result: () => options.result,
    check: (types, problems) => {
      const [list, expr] = types;
      if (list && !couldBe(list, ["array"])) {
        problems.report(0, `${name} needs a list, not ${describeType(list)}`);
        return;
      }
      const each = expr ?? (list ? itemTypeOf(list) : formulaTypes.any);
      if (!couldBe(each, options.itemKinds))
        problems.report(
          expr ? 1 : 0,
          expr
            ? `${name} needs ${options.itemWanted} for each item, not ${describeType(each)}`
            : `${name} needs a list of ${options.itemWanted}, not of ${describeType(each)}; add a second argument, like ${name}(list, field)`,
        );
    },
    special: (call) => {
      const values = call.items(0, call.argCount > 1 ? 1 : undefined);
      if (isFormulaError(values)) return values;
      for (const value of values) {
        if (value === null) continue;
        if (!(options.itemKinds as readonly string[]).includes(kindOf(value)))
          return typeError(name, `${options.itemWanted} for each item`, value);
      }
      return options.reduce(values);
    },
  };
}

function kindOf(value: FormulaValue): FormulaBaseKind | "array" | "error" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (isFormulaError(value)) return "error";
  switch (typeof value) {
    case "number":
      return "number";
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    default:
      return "record";
  }
}

// `if`/`and`/`or`/`not` conditions: true, false, or nothing (false).
export function conditionValue(name: string, value: FormulaValue): boolean | FormulaError {
  if (isFormulaError(value)) return value;
  if (value === null) return false;
  if (typeof value === "boolean") return value;
  return typeError(name, "true or false", value);
}

// Text of a value for concat and text().
function textOf(name: string, value: FormulaValue, booleans: boolean): string | FormulaError {
  if (value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return formatFormulaNumber(value);
  if (typeof value === "boolean" && booleans) return value ? "Yes" : "No";
  return typeError(name, booleans ? "a single value" : "text or numbers", value);
}

// Equality as `==` uses it: same type and value. Lists and records are never
// equal to anything (they can't be compared).
export function formulaEquals(left: FormulaValue, right: FormulaValue) {
  return left === right;
}

// `get(record, key)`: own keys only; a string record is a reference and is
// followed through the loaded references, like a path.
function getValue(record: FormulaValue, key: FormulaValue, refs: SheetRefs): FormulaValue {
  if (record === null || key === null) return null;
  if (typeof key !== "string" && typeof key !== "number")
    return typeError("get", "text or a number as its key", key);
  let container: unknown = record;
  if (typeof container === "string") {
    const ref = findRef(refs, container);
    if (!ref) return null;
    container = refRecord(ref);
  }
  if (Array.isArray(container)) {
    if (typeof key === "number" && Number.isInteger(key) && key >= 0 && key < container.length)
      return toFormulaValue(container[key]);
    if (typeof key === "string" && /^\d+$/.test(key) && Number(key) < container.length)
      return toFormulaValue(container[Number(key)]);
    return null;
  }
  if (typeof container !== "object" || container === null || isFormulaError(container))
    return typeError("get", "a group of fields", record);
  const name = String(key);
  if (isReservedKey(name)) return null;
  return toFormulaValue(ownProperty(container as Record<string, unknown>, name));
}

const functionList: FormulaFunction[] = [
  // Math
  numeric("floor", "Rounds down", Math.floor),
  numeric("ceil", "Rounds up", Math.ceil),
  numeric("trunc", "Drops the fraction (rounds toward zero)", Math.trunc),
  numeric("abs", "The value without its sign", Math.abs),
  {
    name: "round",
    minArgs: 1,
    maxArgs: 2,
    signature: "round(x, digits?)",
    description: "Rounds to the nearest whole number (or to digits after the dot); halves round away from zero",
    result: () => formulaTypes.number,
    check: (types, problems) => expect(types, problems, "round", ["number"], "a number"),
    eager: ([value, digits = 0]) => {
      if (value === null || digits === null) return null;
      if (typeof value !== "number") return typeError("round", "a number", value!);
      if (typeof digits !== "number" || !Number.isInteger(digits) || digits < 0 || digits > 15)
        return new FormulaError("type", "round's digits must be a whole number from 0 to 15");
      return finite(roundHalfAway(value, digits));
    },
  },
  {
    name: "clamp",
    minArgs: 3,
    maxArgs: 3,
    signature: "clamp(x, low, high)",
    description: "x, but no lower than low and no higher than high",
    result: () => formulaTypes.number,
    check: (types, problems) => expect(types, problems, "clamp", ["number"], "numbers"),
    eager: ([value, low, high]) => {
      for (const item of [value, low, high]) {
        if (item !== null && typeof item !== "number") return typeError("clamp", "numbers", item!);
      }
      if (value === null) return null;
      let result = value as number;
      if (typeof low === "number") result = Math.max(result, low);
      if (typeof high === "number") result = Math.min(result, high);
      return result;
    },
  },
  extremum("min"),
  extremum("max"),

  // Lists
  aggregate("sum", {
    signature: "sum(list) or sum(list, expr)",
    description: "Adds up the numbers in a list, or expr for each item (paths in expr are the item's); 0 for an empty list",
    result: formulaTypes.number,
    minArgs: 1,
    itemKinds: ["number"],
    itemWanted: "numbers",
    reduce: (values) =>
      finite(values.reduce<number>((total, value) => total + (typeof value === "number" ? value : 0), 0)),
  }),
  {
    ...aggregate("count", {
      signature: "count(list) or count(list, cond)",
      description: "How many items aren't empty, or how many make cond true (paths in cond are the item's)",
      result: formulaTypes.number,
      minArgs: 1,
      itemKinds: ["boolean"],
      itemWanted: "true or false",
      reduce: (values) => values.filter((value) => value === true).length,
    }),
    // Without a condition every non-empty item counts, whatever its type.
    check: (types, problems) => {
      const [list, cond] = types;
      if (list && !couldBe(list, ["array"])) problems.report(0, `count needs a list, not ${describeType(list)}`);
      else if (cond && !couldBe(cond, ["boolean"]))
        problems.report(1, `count needs true or false for each item, not ${describeType(cond)}`);
    },
    special: (call) => {
      if (call.argCount < 2) {
        const values = call.items(0);
        if (isFormulaError(values)) return values;
        return values.filter((value) => value !== null).length;
      }
      const values = call.items(0, 1);
      if (isFormulaError(values)) return values;
      let total = 0;
      for (const value of values) {
        const condition = conditionValue("count", value);
        if (isFormulaError(condition)) return condition;
        if (condition) total += 1;
      }
      return total;
    },
  },
  aggregate("any", {
    signature: "any(list, cond)",
    description: "Whether cond is true for at least one item (paths in cond are the item's)",
    result: formulaTypes.boolean,
    minArgs: 2,
    itemKinds: ["boolean"],
    itemWanted: "true or false",
    reduce: (values) => values.some((value) => value === true),
  }),
  aggregate("all", {
    signature: "all(list, cond)",
    description: "Whether cond is true for every item (empty items count as false; true for an empty list)",
    result: formulaTypes.boolean,
    minArgs: 2,
    itemKinds: ["boolean"],
    itemWanted: "true or false",
    reduce: (values) => values.every((value) => value === true),
  }),
  {
    name: "list",
    minArgs: 0,
    maxArgs: formulaLimits.maxArgs,
    signature: "list(a, b, …)",
    description:
      "The values as a list, to combine separate fields: join(list(a, b), ', '), sum(list(a, b)); empty values stay in the list; join skips them, and so do sum, min and max",
    result: (types) => arrayOf(types.length ? unionOf(...types) : formulaTypes.any),
    check: (types, problems) =>
      expect(types, problems, "list", ["number", "string", "boolean"], "single values"),
    eager: (args) => {
      for (const value of args) {
        if (value !== null && (Array.isArray(value) || typeof value === "object"))
          return typeError("list", "single values", value);
      }
      return args;
    },
  },
  {
    name: "length",
    minArgs: 1,
    maxArgs: 1,
    signature: "length(x)",
    description: "The number of characters in text, or of items in a list",
    result: () => formulaTypes.number,
    check: (types, problems) => expect(types, problems, "length", ["string", "array"], "text or a list"),
    eager: ([value]) => {
      if (value === null) return null;
      if (typeof value === "string" || Array.isArray(value)) return value.length;
      return typeError("length", "text or a list", value!);
    },
  },
  {
    name: "coalesce",
    minArgs: 1,
    maxArgs: formulaLimits.maxArgs,
    lazy: true,
    signature: "coalesce(a, b, …)",
    description: "The first value that isn't empty",
    result: (types) => unionOf(...types),
    special: (call) => {
      for (let index = 0; index < call.argCount; index += 1) {
        const value = call.value(index);
        if (value !== null) return value;
      }
      return null;
    },
  },

  // Text
  {
    name: "concat",
    minArgs: 1,
    maxArgs: formulaLimits.maxArgs,
    signature: "concat(a, b, …)",
    description: "Joins text and numbers into one text; empty values add nothing",
    result: () => formulaTypes.string,
    check: (types, problems) => expect(types, problems, "concat", ["string", "number"], "text or numbers"),
    eager: (args) => {
      let text = "";
      for (const value of args) {
        const part = textOf("concat", value, false);
        if (isFormulaError(part)) return part;
        text += part;
        if (text.length > formulaLimits.maxStringLength) return textTooLong();
      }
      return text;
    },
  },
  {
    name: "join",
    minArgs: 2,
    maxArgs: 2,
    walksLists: true,
    signature: "join(list, separator)",
    description: "Joins a list of text or numbers with separator between them, skipping empty items (nothing and empty text)",
    result: () => formulaTypes.string,
    check: (types, problems) => {
      const [list, separator] = types;
      if (list && !couldBe(list, ["array"])) problems.report(0, `join needs a list, not ${describeType(list)}`);
      else if (list && !couldBe(itemTypeOf(list), ["string", "number"]))
        problems.report(0, `join needs a list of text or numbers, not of ${describeType(itemTypeOf(list))}`);
      expect(types, problems, "join", ["string"], "text as its separator", separator ? [1] : []);
    },
    eager: ([list, separator]) => {
      if (list === null) return null;
      if (!Array.isArray(list)) return typeError("join", "a list", list!);
      if (separator !== null && typeof separator !== "string")
        return typeError("join", "text as its separator", separator!);
      let text = "";
      let first = true;
      for (const item of list as unknown[]) {
        const value = toFormulaValue(item);
        if (value === null || value === "") continue;
        const part = textOf("join", value, false);
        if (isFormulaError(part)) return part;
        text += first ? part : (separator ?? "") + part;
        first = false;
        if (text.length > formulaLimits.maxStringLength) return textTooLong();
      }
      return text;
    },
  },
  {
    name: "signed",
    minArgs: 1,
    maxArgs: 1,
    signature: "signed(n)",
    description: "A number as text with its sign: +3, 0, -1",
    result: () => formulaTypes.string,
    check: (types, problems) => expect(types, problems, "signed", ["number"], "a number"),
    eager: ([value]) => {
      if (value === null) return null;
      if (typeof value !== "number") return typeError("signed", "a number", value!);
      return value > 0 ? `+${formatFormulaNumber(value)}` : formatFormulaNumber(value);
    },
  },

  // Conversion
  {
    name: "number",
    minArgs: 1,
    maxArgs: 1,
    signature: "number(x)",
    description: "Text like \"12\" or \"-1.5\" as a number; nothing if it isn't one",
    result: () => formulaTypes.number,
    check: (types, problems) => expect(types, problems, "number", ["string", "number"], "text or a number"),
    eager: ([value]) => {
      if (value === null || typeof value === "number") return value;
      if (typeof value !== "string") return typeError("number", "text or a number", value!);
      const text = value.trim();
      return /^-?\d+(?:\.\d+)?$/.test(text) ? finite(Number(text)) : null;
    },
  },
  {
    name: "text",
    minArgs: 1,
    maxArgs: 1,
    signature: "text(x)",
    description: "A value as text (true and false as Yes and No)",
    result: () => formulaTypes.string,
    check: (types, problems) =>
      expect(types, problems, "text", ["string", "number", "boolean"], "a single value"),
    eager: ([value]) => textOf("text", value!, true),
  },

  // Logic
  {
    name: "if",
    minArgs: 3,
    maxArgs: 3,
    lazy: true,
    signature: "if(cond, then, else)",
    description: "then when cond is true, else otherwise (empty counts as false); only the chosen one is computed",
    result: ([, then, otherwise]) => unionOf(then ?? formulaTypes.any, otherwise ?? formulaTypes.any),
    check: (types, problems) => expect(types, problems, "if", ["boolean"], "true or false", [0]),
    special: (call) => {
      const condition = conditionValue("if", call.value(0));
      if (isFormulaError(condition)) return condition;
      return call.value(condition ? 1 : 2);
    },
  },
  {
    name: "switch",
    minArgs: 3,
    maxArgs: formulaLimits.maxArgs,
    lazy: true,
    signature: "switch(value, case1, result1, …, default?)",
    description: "The result after the first case equal to value; default (or nothing) if none is",
    result: (types) => {
      const results = types.filter((_, index) => index > 0 && index % 2 === 0);
      const hasDefault = types.length % 2 === 0;
      return unionOf(
        ...results,
        ...(hasDefault ? [types.at(-1)!] : [formulaTypes.null]),
      );
    },
    special: (call) => {
      const value = call.value(0);
      if (isFormulaError(value)) return value;
      let index = 1;
      for (; index + 1 < call.argCount; index += 2) {
        const candidate = call.value(index);
        if (isFormulaError(candidate)) return candidate;
        if (formulaEquals(value, candidate)) return call.value(index + 1);
      }
      return index < call.argCount ? call.value(index) : null;
    },
  },

  // Lookup
  {
    name: "get",
    minArgs: 2,
    maxArgs: 2,
    signature: "get(record, key)",
    description: "The field of record named by key, like get(attributes, 'dex'); follows references like a path",
    result: () => formulaTypes.any,
    check: (types, problems) => {
      expect(types, problems, "get", ["record", "string", "array"], "a group of fields", [0]);
      expect(types, problems, "get", ["string", "number"], "text or a number as its key", [1]);
    },
    special: (call) => {
      const record = call.value(0);
      if (isFormulaError(record)) return record;
      const key = call.value(1);
      if (isFormulaError(key)) return key;
      return getValue(record, key, call.refs);
    },
  },
];

export const formulaFunctions: ReadonlyMap<string, FormulaFunction> = new Map(
  functionList.map((fn) => [fn.name, fn]),
);

// Names for dice rolls, kept free for a later version.
export const formulaDiceNames: readonly string[] = ["roll", "dice", "adv", "dis"];

export const diceNotAvailable = "Dice rolls aren't available here yet";

// Built-in functions added after the first version. A sheet's `<Define>` with
// one of these names keeps working (it wins in that sheet, with a warning);
// add new built-ins here, never to formulaReservedNames.
export const formulaLaterBuiltins: readonly string[] = ["list"];

// Names a `<Define>` can't use.
export const formulaReservedNames: ReadonlySet<string> = new Set([
  ...functionList.map((fn) => fn.name).filter((name) => !formulaLaterBuiltins.includes(name)),
  ...formulaDiceNames,
  ...formulaReservedWords,
]);

export type FormulaCallTarget = "builtin" | "definition" | "dice" | "unknown";

// How a call by this name resolves: a first-version built-in always wins, then
// the sheet's own definition, then a later built-in.
export function resolveFormulaCall(
  name: string,
  hasDefinition: (name: string) => boolean,
  laterBuiltins: readonly string[] = formulaLaterBuiltins,
): FormulaCallTarget {
  const builtin = formulaFunctions.has(name);
  if (builtin && !laterBuiltins.includes(name)) return "builtin";
  if (hasDefinition(name)) return "definition";
  if (builtin) return "builtin";
  if (formulaDiceNames.includes(name)) return "dice";
  return "unknown";
}

// "takes 1 argument", "takes 1 or 2 arguments", "takes at least 2 arguments"
export function describeArity(min: number, max: number) {
  const plural = (count: number) => `${count} argument${count === 1 ? "" : "s"}`;
  if (min === max) return `takes ${plural(min)}`;
  if (max >= formulaLimits.maxArgs) return `takes at least ${plural(min)}`;
  if (max === min + 1) return `takes ${min} or ${plural(max)}`;
  return `takes ${min} to ${plural(max)}`;
}
