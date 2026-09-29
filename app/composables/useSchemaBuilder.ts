import type { ComputedRef, InjectionKey } from "vue";

export interface SchemaBuilderContext {
  // Blocking problems by builder node id (see `builderErrors`).
  errors: ComputedRef<Map<string, string>>;
  // Content types a `content` field can point at.
  contentTypeOptions: ComputedRef<{ label: string; value: string }[]>;
  readonly: ComputedRef<boolean>;
}

const key: InjectionKey<SchemaBuilderContext> = Symbol("schemaBuilder");

export function provideSchemaBuilder(context: SchemaBuilderContext) {
  provide(key, context);
}

// Shared by every component of one schema builder (see SchemaBuilder.vue).
export function useSchemaBuilder() {
  const context = inject(key);
  if (!context) throw new Error("useSchemaBuilder needs a SchemaBuilder");
  return context;
}
