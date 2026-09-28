import type { InjectionKey, Ref } from "vue";
import type { Interpolation, TextPart } from "#shared/sheet/parser";
import {
  formatSheetValue,
  interpolateSheetText,
  itemScopes,
  resolveSheetPath,
  type SheetRefs,
  type SheetScope,
} from "#shared/sheet/runtime";
import {
  parseSheetPath,
  type AttrValue,
  type SheetPath,
  type ValidatedElement,
} from "#shared/sheet/validate";

// Shared by every component of one rendered Sheet (see SheetRenderer.vue).
export interface SheetContext {
  root: Ref<SheetScope>;
  refs: Ref<SheetRefs>;
  // Show placeholders for broken tags (users who can edit the Sheet).
  showInvalid: Ref<boolean>;
}

const contextKey: InjectionKey<SheetContext> = Symbol("sheet");
const scopeKey: InjectionKey<Ref<SheetScope>> = Symbol("sheet-scope");

export function provideSheetContext(context: SheetContext) {
  provide(contextKey, context);
  provide(scopeKey, context.root);
}

export function provideSheetScope(scope: Ref<SheetScope>) {
  provide(scopeKey, scope);
}

// Resolving paths and text against the current List item (or the top level).
export function useSheet() {
  const context = inject(contextKey);
  const scope = inject(scopeKey);
  if (!context || !scope) throw new Error("Sheet components need a SheetRenderer");

  const resolve = (path: SheetPath | string) =>
    resolveSheetPath(
      typeof path === "string" ? parseSheetPath(path) : path,
      context.root.value,
      scope.value,
      context.refs.value,
    );

  return {
    context,
    scope,
    resolve,
    items: (path: SheetPath) => itemScopes(resolve(path)),
    format: (value: unknown, format?: "plain" | "signed") =>
      formatSheetValue(value, context.refs.value, format),
    text: (parts: TextPart[]) =>
      interpolateSheetText(parts, context.root.value, scope.value, context.refs.value),
    // A number attribute: a literal or a {path} resolved now.
    number: (value: AttrValue | undefined) => {
      if (typeof value === "number") return value;
      if (value && typeof value === "object" && "path" in value) {
        const resolved = resolve((value as Interpolation).path).value;
        return typeof resolved === "number" ? resolved : undefined;
      }
      return undefined;
    },
  };
}

// Text of a text-only tag (Heading, Note, ...): its text children joined.
export function useSheetChildText(node: () => ValidatedElement) {
  const { text } = useSheet();
  return computed(() =>
    node()
      .children.map((child) => (child.type === "text" ? text(child.parts) : ""))
      .filter(Boolean)
      .join(" "),
  );
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
