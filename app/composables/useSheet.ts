import type { InjectionKey, Ref } from "vue";
import {
  formulaLimits,
  isFormulaError,
  type FormulaNode,
  type FormulaValue,
} from "#shared/sheet/formula";
import type { TextPart } from "#shared/sheet/parser";
import type { SheetDisplay } from "#shared/sheet/registry";
import {
  evaluateSheetFormula,
  formatFormulaValue,
  sheetCondition,
  formatSheetValue,
  interpolateSheetText,
  itemScopes,
  resolveSheetPath,
  sheetTextSegments,
  type SheetFormulaDefinitions,
  type SheetTextSegment,
  type SheetLink,
  type SheetLinks,
  type SheetRef,
  type SheetRefs,
  type SheetScope,
} from "#shared/sheet/runtime";
import {
  isCompiledFormula,
  parseSheetPath,
  type AttrValue,
  type SheetPath,
  type SheetSchemas,
  type ValidatedElement,
  type ValidatedNode,
} from "#shared/sheet/validate";

// Shared by every component of one rendered Sheet (see SheetRenderer.vue).
export interface SheetContext {
  root: Ref<SheetScope>;
  refs: Ref<SheetRefs>;
  // Resources linked by `resourceLink` fields that the viewer can read.
  links: Ref<SheetLinks>;
  schemas: Ref<SheetSchemas>;
  // The sheet's `<Define>`s, with cached values of those without parameters.
  formulas: Ref<SheetFormulaDefinitions>;
  // Show placeholders for broken tags (users who can edit the Sheet).
  showInvalid: Ref<boolean>;
  // The viewer may edit the Content, and the Edit switch is on.
  canEdit: Ref<boolean>;
  editMode: Ref<boolean>;
  // How fields look when they can't be edited, before any `display` attribute.
  defaultDisplay: Ref<SheetDisplay>;
  // Writes a value into the Content's draft data.
  update: (path: (string | number)[], value: unknown) => void;
  // Makes referenced Content picked while editing displayable before saving.
  addRef: (id: string, ref: SheetRef) => void;
  // Same for resources picked in `resourceLink` fields.
  addLink: (id: string, link: SheetLink) => void;
  // `locked` fields unlocked with their pencil button, for this page view.
  unlocked: Set<string>;
}

// `live` / `locked` / `display` in effect, inherited from enclosing tags.
export interface SheetFlags {
  live: boolean;
  locked: boolean;
  display: SheetDisplay;
}

const defaultFlags = (): SheetFlags => ({
  live: false,
  locked: false,
  display: "text",
});

const contextKey: InjectionKey<SheetContext> = Symbol("sheet");
const scopeKey: InjectionKey<Ref<SheetScope>> = Symbol("sheet-scope");
const flagsKey: InjectionKey<Ref<SheetFlags>> = Symbol("sheet-flags");
// How many times this part of the sheet is repeated (the item counts of the
// enclosing Lists and Table rows, multiplied).
const repeatKey: InjectionKey<Ref<number>> = Symbol("sheet-repeat");

export function provideSheetContext(context: SheetContext) {
  provide(contextKey, context);
  provide(scopeKey, context.root);
  provide(
    flagsKey,
    computed(() => ({ ...defaultFlags(), display: context.defaultDisplay.value })),
  );
}

// `repeat`: how many siblings this scope has (the List's or Table's items).
export function provideSheetScope(scope: Ref<SheetScope>, repeat?: () => number) {
  provide(scopeKey, scope);
  const parent = inject(repeatKey, ref(1));
  provide(repeatKey, computed(() => parent.value * Math.max(repeat?.() ?? 1, 1)));
}

// Applies a tag's own live/locked/display attributes on top of the inherited
// ones, for the tag and everything inside it.
export function provideSheetFlags(node: () => ValidatedNode) {
  const parent = inject(flagsKey, ref(defaultFlags()));
  const flags = computed<SheetFlags>(() => {
    const current = node();
    if (current.type !== "element") return parent.value;
    const { live, locked, display } = current.attrs;
    return {
      live: typeof live === "boolean" ? live : parent.value.live,
      locked: typeof locked === "boolean" ? locked : parent.value.locked,
      display:
        display === "text" || display === "box" ? display : parent.value.display,
    };
  });
  provide(flagsKey, flags);
  return flags;
}

// Whether a field (or List/Table) at `path` can be edited right now, and its
// locked state. `path` is null for values reached through references.
export function useSheetEditable(
  node: () => ValidatedElement,
  path: () => (string | number)[] | null,
) {
  const { context } = useSheet();
  const flags = inject(flagsKey, ref(defaultFlags()));
  const unlockKey = computed(
    () => `${node().loc.start.offset}:${JSON.stringify(path())}`,
  );
  const unlocked = computed(() => context.unlocked.has(unlockKey.value));
  const allowed = computed(
    () =>
      context.canEdit.value &&
      path() !== null &&
      node().tag !== "Value" &&
      (context.editMode.value || flags.value.live),
  );
  return {
    // Editable now.
    editable: computed(
      () => allowed.value && (!flags.value.locked || unlocked.value),
    ),
    // Would be editable after clicking the pencil button.
    lockedEditable: computed(
      () => allowed.value && flags.value.locked && !unlocked.value,
    ),
    unlock: () => context.unlocked.add(unlockKey.value),
    // Shown as a disabled input when not editable (`display="box"`).
    boxed: computed(() => flags.value.display === "box"),
  };
}

// Resolving paths and text against the current List item (or the top level).
export function useSheet() {
  const context = inject(contextKey);
  const scope = inject(scopeKey);
  const repeat = inject(repeatKey, ref(1));
  if (!context || !scope) throw new Error("Sheet components need a SheetRenderer");

  // A formula repeated for every item of a List shares the sheet's step
  // budget with its copies, so a long List can't make a render take seconds.
  const formulas = (times = 1): SheetFormulaDefinitions => {
    const current = context.formulas.value;
    const budget = current.stepBudget ?? formulaLimits.maxSteps;
    return { ...current, stepBudget: Math.max(1, Math.floor(budget / (repeat.value * times))) };
  };

  const resolve = (path: SheetPath | string) =>
    resolveSheetPath(
      typeof path === "string" ? parseSheetPath(path) : path,
      context.root.value,
      scope.value,
      context.refs.value,
    );

  // A formula's value in the current scope (an error value if it fails).
  const evaluate = (ast: FormulaNode): FormulaValue =>
    evaluateSheetFormula(
      ast,
      context.root.value,
      scope.value,
      context.refs.value,
      formulas(),
    );

  return {
    context,
    scope,
    resolve,
    evaluate,
    items: (path: SheetPath) => itemScopes(resolve(path)),
    format: (value: unknown, format?: "plain" | "signed") =>
      formatSheetValue(value, context.refs.value, format),
    // A formula value as text ("" for errors and nothing).
    formatFormula: (value: FormulaValue, format?: "plain" | "signed") =>
      formatFormulaValue(value, context.refs.value, format),
    text: (parts: TextPart[]) =>
      interpolateSheetText(
        parts,
        context.root.value,
        scope.value,
        context.refs.value,
        formulas(),
      ),
    // Text with the formulas that failed marked, to show their message.
    segments: (parts: TextPart[]): SheetTextSegment[] =>
      sheetTextSegments(
        parts,
        context.root.value,
        scope.value,
        context.refs.value,
        formulas(),
      ),
    // A tag's `show` in the current scope, or in `at`, one of `times` rows
    // (a Table's RowDetails).
    condition: (show: AttrValue | undefined, at?: SheetScope, times?: number) =>
      sheetCondition(
        show,
        context.root.value,
        at ?? scope.value,
        context.refs.value,
        formulas(times),
      ),
    // A number attribute: a literal, or a {formula} computed now.
    number: (value: AttrValue | undefined) => {
      if (typeof value === "number") return value;
      if (isCompiledFormula(value)) {
        const result = evaluate(value.ast);
        return typeof result === "number" && !isFormulaError(result) ? result : undefined;
      }
      return undefined;
    },
  };
}

// Text of a text-only tag (Heading, Note, ...): its text children joined, as
// segments (see SheetInlineText).
export function useSheetChildSegments(node: () => ValidatedElement) {
  const { segments } = useSheet();
  return computed(() => {
    const texts = node()
      .children.map((child) => (child.type === "text" ? segments(child.parts) : []))
      .filter((parts) => parts.some((segment) => segment.text));
    return texts.flatMap((parts, index) => (index ? [{ text: " " }, ...parts] : parts));
  });
}

// Editing the array bound to a List or Table.
export function useSheetListEditing(
  node: () => ValidatedElement,
  list: Ref<SheetScope>,
) {
  const { context } = useSheet();
  const editing = useSheetEditable(node, () => list.value.path);
  const current = () => (Array.isArray(list.value.value) ? list.value.value : []);
  const write = (items: unknown[]) => {
    if (list.value.path) context.update(list.value.path, items);
  };
  return {
    ...editing,
    remove: (index: number) => write(current().filter((_, item) => item !== index)),
    move: (index: number, offset: number) => {
      const items = [...current()];
      const target = index + offset;
      if (target < 0 || target >= items.length) return;
      [items[index], items[target]] = [items[target], items[index]];
      write(items);
    },
  };
}

// How a field tag shows its value: the tag's own display, or for <Field> and
// <Column> one picked from the schema type.
export type SheetFieldDisplay =
  | "text"
  | "select"
  | "number"
  | "stat"
  | "boolean"
  | "tags"
  | "tracker"
  | "ref"
  | "scalar"
  | "json"
  | "value"
  | "markdown"
  | "image";

export function sheetFieldDisplay(node: ValidatedElement): SheetFieldDisplay {
  const { tag, attrs, binding } = node;
  switch (tag) {
    case "Text":
      return "text";
    case "Select":
      return "select";
    case "Number":
      return attrs.variant === "stat" ? "stat" : "number";
    case "Checkbox":
    case "Toggle":
      return "boolean";
    case "Tags":
      return "tags";
    case "Tracker":
      return "tracker";
    case "Ref":
      return "ref";
    case "Markdown":
      return "markdown";
    case "Image":
      return "image";
    case "Value":
      return "value";
  }
  switch (binding?.field?.type) {
    case "string":
      return "text";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "resourceLink":
    case "content":
      return "ref";
    case "scalar":
      return "scalar";
    case "object":
      return "json";
    case "array":
      return "tags";
    default:
      return "value";
  }
}

// Hook class plus the author's classes, for a tag's root element.
export function sheetClasses(node: ValidatedElement) {
  const extra = node.attrs.class;
  return [
    `sheet-${node.tag.toLowerCase()}`,
    ...(Array.isArray(extra) ? (extra as string[]) : []),
  ];
}

// Literal text of a text attribute, interpolated.
export function useSheetAttrText() {
  const { text } = useSheet();
  return (value: AttrValue | undefined) =>
    Array.isArray(value) ? text(value as TextPart[]) : "";
}
