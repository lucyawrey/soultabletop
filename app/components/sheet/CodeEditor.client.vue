<script setup lang="ts">
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { css as cssLanguage } from "@codemirror/lang-css";
import { xml, xmlLanguage } from "@codemirror/lang-xml";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { EditorState, type Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import type { Position, SheetDiagnostic } from "#shared/sheet/parser";
import { commonAttrs, sheetTags } from "#shared/sheet/registry";

// CodeMirror for Sheet markup or CSS: our diagnostics inline, and for markup
// completion of tags, attributes, and field paths. Client-only.
const props = defineProps<{
  modelValue: string;
  language: "markup" | "css";
  diagnostics: SheetDiagnostic[];
  // Paths offered inside field="…" and {…} (markup only).
  fieldPaths?: string[];
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
    attributes: Object.entries({ ...spec.attrs, ...commonAttrs }).map(
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

  // Field paths inside field="…" / max="{…}" / text {…}.
  const fieldPathSource = (context: CompletionContext) => {
    const match =
      context.matchBefore(/field\s*=\s*["'][\w./]*$/) ??
      context.matchBefore(/\{[\w./]*$/);
    if (!match) return null;
    const typed = match.text.match(/[\w./]*$/)![0];
    const paths = new Set<string>();
    for (const path of props.fieldPaths ?? []) {
      // Paths inside Lists are relative to the item: offer their tail too.
      const [, tail] = path.split(/\[\]\.(?=[^[]*$)/);
      if (!path.includes("[]")) paths.add(path);
      if (tail) paths.add(tail);
    }
    return {
      from: match.to - typed.length,
      options: [...paths].map((path) => ({ label: path, type: "variable" })),
      validFor: /^[\w./]*$/,
    };
  };

  return [
    xml({ elements, autoCloseTags: true }),
    xmlLanguage.data.of({ autocomplete: fieldPathSource }),
  ];
}

function toOffset(doc: Text, position: Position) {
  const line = doc.line(Math.min(Math.max(position.line, 1), doc.lines));
  return Math.min(line.from + Math.max(position.column - 1, 0), line.to);
}

function codemirrorDiagnostics(doc: Text): Diagnostic[] {
  return props.diagnostics.map((item) => {
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
});

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        theme,
        lintGutter(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ "aria-label": props.label }),
        ...(props.language === "markup"
          ? markupExtensions()
          : [cssLanguage(), autocompletion()]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) emit("update:modelValue", update.state.doc.toString());
        }),
      ],
    }),
  });
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
  () => props.diagnostics,
  () => {
    if (view) view.dispatch(setDiagnostics(view.state, codemirrorDiagnostics(view.state.doc)));
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
    class="h-full min-h-80 overflow-hidden rounded-md border border-default"
  />
</template>
