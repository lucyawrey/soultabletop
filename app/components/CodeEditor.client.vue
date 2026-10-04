<script setup lang="ts">
import {
  autocompletion,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { css as cssLanguage } from "@codemirror/lang-css";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { xml, xmlLanguage } from "@codemirror/lang-xml";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import {
  linter,
  lintGutter,
  setDiagnostics,
  type Diagnostic,
} from "@codemirror/lint";
import { EditorState, RangeSetBuilder, StateEffect, type Text } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { basicSetup } from "codemirror";
import { formulaReservedWords } from "#shared/sheet/formula";
import { formulaFunctions, formulaLaterBuiltins } from "#shared/sheet/formula-functions";
import {
  formulaHighlights,
  markupFormulaRanges,
  type MarkupFormulaRange,
} from "#shared/sheet/editor";
import type { Position, SheetDiagnostic } from "#shared/sheet/parser";
import { commonAttrsFor, sheetTags } from "#shared/sheet/registry";

// CodeMirror for Sheet markup and CSS (our diagnostics inline, and for markup
// completion of tags, attributes, and field paths) and for raw JSON (syntax
// errors inline). Client-only. Give it a fixed height (e.g. `class="h-80"`); it
// scrolls inside that, and the user can drag its corner to resize it.
const props = defineProps<{
  modelValue: string;
  language: "markup" | "css" | "json";
  // Sheet markup/CSS problems to show (JSON is checked by CodeMirror).
  diagnostics?: SheetDiagnostic[];
  readonly?: boolean;
  // Paths offered inside field="…", {…}, and formulas (markup only).
  fieldPaths?: string[];
  // The sheet's <Define>s, offered and colored in formulas (markup only).
  formulaDefinitions?: { name: string; params: string[] }[];
  label: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const host = ref<HTMLElement>();
let view: EditorView | undefined;

const allTags = [...sheetTags.values()].map((spec) => spec.name);

function markupExtensions() {
  const elements = [...sheetTags.values()].map((spec) => ({
    name: spec.name,
    top: !spec.parents?.length,
    children:
      spec.children === "any"
        ? allTags
        : typeof spec.children === "object"
          ? [...spec.children.only]
          : [],
    attributes: Object.entries({ ...spec.attrs, ...commonAttrsFor(spec) }).map(
      ([name, attr]) => ({
        name,
        values:
          attr.type.kind === "enum"
            ? [...attr.type.values]
            : attr.type.kind === "boolean"
              ? ["true", "false"]
              : undefined,
      }),
    ),
  }));

  // Paths with List item paths also offered by their tail.
  const pathOptions = () => {
    const paths = new Set<string>();
    for (const path of props.fieldPaths ?? []) {
      // Paths inside Lists are relative to the item: offer their tail too.
      const [, tail] = path.split(/\[\]\.(?=[^[]*$)/);
      if (!path.includes("[]")) paths.add(path);
      if (tail) paths.add(tail);
    }
    return [...paths];
  };

  // Inside a formula: paths, built-in functions, the sheet's definitions, and
  // (in a <Define>) its parameters.
  const formulaSource = (context: CompletionContext) => {
    const range = formulaRangeAt(context.state.doc.toString(), context.pos);
    if (!range) return null;
    const match = context.matchBefore(/\/?[\w.]*$/);
    if (!match || (match.from === match.to && !context.explicit)) return null;
    const typed = match.text;
    const options: Completion[] = pathOptions().map((path) => ({
      label: typed.startsWith("/") ? `/${path}` : path,
      type: "variable",
    }));
    if (!typed.includes(".") && !typed.startsWith("/")) {
      const definitions = props.formulaDefinitions ?? [];
      for (const fn of formulaFunctions.values()) {
        if (formulaLaterBuiltins.includes(fn.name) && definitions.some((item) => item.name === fn.name))
          continue;
        options.push({
          label: fn.name,
          type: "function",
          detail: fn.signature,
          info: fn.description,
          apply: `${fn.name}(`,
          boost: 1,
        });
      }
      for (const definition of definitions) {
        options.push({
          label: definition.name,
          type: "method",
          detail: `${definition.name}(${definition.params.join(", ")}) · this sheet`,
          apply: `${definition.name}(`,
          boost: 2,
        });
      }
      for (const param of range.params) {
        options.push({ label: param, type: "variable", detail: "parameter", boost: 3 });
      }
      for (const word of formulaReservedWords) options.push({ label: word, type: "keyword" });
    }
    return { from: match.from, options, validFor: /^\/?[\w.]*$/ };
  };

  // Field paths inside field="…" / max="{…}" / text {…}.
  const fieldPathSource = (context: CompletionContext) => {
    const match =
      context.matchBefore(/field\s*=\s*["'][\w./]*$/) ??
      context.matchBefore(/\{[\w./]*$/);
    if (!match) return null;
    const typed = match.text.match(/[\w./]*$/)![0];
    return {
      from: match.to - typed.length,
      options: pathOptions().map((path) => ({ label: path, type: "variable" })),
      validFor: /^[\w./]*$/,
    };
  };

  return [
    xml({ elements, autoCloseTags: true }),
    xmlLanguage.data.of({ autocomplete: formulaSource }),
    xmlLanguage.data.of({ autocomplete: fieldPathSource }),
    formulaColors,
  ];
}

// The formula the cursor is in, if any.
function formulaRangeAt(doc: string, pos: number): MarkupFormulaRange | undefined {
  return markupFormulaRanges(doc).find((range) => range.from <= pos && pos <= range.to);
}

// Colors built-in functions, the sheet's definitions, and parameters in
// formulas. Recomputed on edits and when the definitions change.
const refreshFormulaColors = StateEffect.define<null>();
const formulaMarks = {
  builtin: Decoration.mark({ class: "cm-formula-builtin" }),
  define: Decoration.mark({ class: "cm-formula-define" }),
  param: Decoration.mark({ class: "cm-formula-param" }),
};
function formulaDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc.toString();
  const definitions = new Set((props.formulaDefinitions ?? []).map((item) => item.name));
  const builder = new RangeSetBuilder<Decoration>();
  for (const range of markupFormulaRanges(doc)) {
    const source = doc.slice(range.from, range.to);
    for (const mark of formulaHighlights(source, range.params, definitions)) {
      builder.add(range.from + mark.from, range.from + mark.to, formulaMarks[mark.kind]);
    }
  }
  return builder.finish();
}
const formulaColors = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = formulaDecorations(view);
    }

    update(update: ViewUpdate) {
      const refreshed = update.transactions.some((transaction) =>
        transaction.effects.some((effect) => effect.is(refreshFormulaColors)),
      );
      if (update.docChanged || refreshed) this.decorations = formulaDecorations(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function toOffset(doc: Text, position: Position) {
  const line = doc.line(Math.min(Math.max(position.line, 1), doc.lines));
  return Math.min(line.from + Math.max(position.column - 1, 0), line.to);
}

function codemirrorDiagnostics(doc: Text): Diagnostic[] {
  return (props.diagnostics ?? []).map((item) => {
    const from = toOffset(doc, item.loc.start);
    let to = Math.max(from, toOffset(doc, item.loc.end));
    if (to === from) to = Math.min(from + 1, doc.length);
    return { from, to, severity: item.severity, message: item.message };
  });
}

// Colors from Nuxt UI tokens so the editor follows the app theme.
const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    backgroundColor: "var(--ui-bg)",
    color: "var(--ui-text)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  ".cm-gutters": {
    backgroundColor: "var(--ui-bg-elevated)",
    color: "var(--ui-text-dimmed)",
    border: "none",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "color-mix(in oklab, var(--ui-primary) 8%, transparent)",
  },
  ".cm-cursor": { borderLeftColor: "var(--ui-text)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "color-mix(in oklab, var(--ui-primary) 25%, transparent) !important",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--ui-bg-elevated)",
    color: "var(--ui-text)",
    border: "1px solid var(--ui-border)",
  },
  // Names in formulas, over the attribute value color. Same text-safe roles
  // as the syntax colors below; weight and style keep them apart without
  // relying on color alone.
  ".cm-formula-builtin, .cm-formula-builtin *": { color: "var(--ui-secondary)", fontWeight: "600" },
  ".cm-formula-define, .cm-formula-define *": { color: "var(--ui-primary)", fontWeight: "600" },
  ".cm-formula-param, .cm-formula-param *": { color: "var(--ui-info)", fontStyle: "italic" },
});

// Syntax colors from the theme's text-safe roles (each at least 4.5:1 on the
// page and on the active line), replacing CodeMirror's default colors, some of
// which fall under that.
const highlightStyle = HighlightStyle.define([
  { tag: [tags.tagName, tags.angleBracket], color: "var(--ui-primary)" },
  { tag: [tags.attributeName, tags.propertyName], color: "var(--ui-info)" },
  { tag: [tags.string, tags.attributeValue], color: "var(--ui-success)" },
  {
    tag: [tags.number, tags.bool, tags.null, tags.unit, tags.color],
    color: "var(--ui-warning)",
  },
  {
    tag: [tags.keyword, tags.className, tags.labelName, tags.definitionKeyword],
    color: "var(--ui-secondary)",
  },
  { tag: tags.comment, color: "var(--ui-text-dimmed)", fontStyle: "italic" },
  { tag: tags.invalid, color: "var(--ui-error)" },
]);

// A .client component mounted during hydration runs onMounted before its
// template renders, so wait for `host` to exist.
onMounted(async () => {
  await nextTick();
  if (!host.value) return;
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        theme,
        syntaxHighlighting(highlightStyle),
        lintGutter(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ "aria-label": props.label }),
        ...(props.language === "markup"
          ? markupExtensions()
          : props.language === "css"
            ? [cssLanguage(), autocompletion()]
            : [json(), linter(jsonParseLinter())]),
        ...(props.readonly
          ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
          : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) emit("update:modelValue", update.state.doc.toString());
        }),
      ],
    }),
  });
  if (props.language !== "json")
    view.dispatch(setDiagnostics(view.state, codemirrorDiagnostics(view.state.doc)));
});

onBeforeUnmount(() => view?.destroy());

// Outside changes (e.g. "Insert generated markup").
watch(
  () => props.modelValue,
  (value) => {
    if (!view || value === view.state.doc.toString()) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  },
);

watch(
  () => props.formulaDefinitions,
  () => view?.dispatch({ effects: refreshFormulaColors.of(null) }),
);

watch(
  () => props.diagnostics,
  () => {
    if (view && props.language !== "json") view.dispatch(setDiagnostics(view.state, codemirrorDiagnostics(view.state.doc)));
  },
);

defineExpose({
  // Moves the cursor to a diagnostic's position.
  goTo(position: Position) {
    if (!view) return;
    const offset = toOffset(view.state.doc, position);
    view.dispatch({ selection: { anchor: offset }, scrollIntoView: true });
    view.focus();
  },
  // Inserts text at the cursor.
  insert(text: string) {
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  },
});
</script>

<template>
  <div
    ref="host"
    class="min-h-24 resize-y overflow-hidden rounded-md border border-default"
  />
</template>
