# Sheet schema design: choice fields and tables over fixed rows

Decided with the user on 2026-10-04. Two PRs, in order: **A. Choice fields**, then **B. Tables over fixed rows**. Each
PR updates `docs/sheet-system.md` (and `.claude/data-model.md` where the schema changes) with what it builds; this file
can be deleted once both have merged.

Motivating sheets: the Pathfinder 2e test sheet (`pf2e-test`: 16 skills and 3 saves written as hand-made rows, every
rank a `Select` of lowercase text, the Lores rank column a free text box) and the D&D 2024 sheet (18 skills as one small
`Grid` each; size, alignment, training, and spellcasting ability as free text).

## A. Choice fields

### Schema (decided: `options` on `string` and `number`, not a new type)
```ts
| { type: "string"; options?: { value: string; label?: string }[] }
| { type: "number"; options?: { value: number; label?: string }[] }
```
- A choice field stays a `string` or `number` everywhere else (formula types, binding rules, formatting), so only the
  places that care about options change. Number options let ranks be 0–4 with labels, so formulas can do arithmetic
  (`level + rank * 2`) instead of `switch` over text.
- Rules: at least 1 option, at most 200; values unique, of the field's type (finite numbers); `label` optional, 1–100
  characters, defaulting to the value as text. Option order is the order shown.
- `ContentFieldSchema` and the TypeBox mirror (`contentTypeSchemaSchema`) stay in sync: split the `string`/`number`
  variant out of the shared literal union so each carries its own typed `options`; uniqueness is a server check with a
  clear message.
- Content validation: a value must be one of the option values, whatever the strictness (strictness is about extra
  keys). An absent non-required field means "no choice"; `""` is only valid if listed.
- `defaultContentData`: a required choice field starts at its first option.
- Changing options doesn't touch saved data. Content holding a value no longer listed renders it as text (like any
  drifted value) and, in a `Select`, as an extra "(not an option)" item; saving fails until it's changed.

### Sheets
- `Select` with no `options` attribute takes the schema's options. The attribute stays for fields without schema
  options (works as today); on a field with schema options it's a **warning** and the schema's list wins (decided), so
  adding options to a schema never breaks a sheet. `Select` without either is an error.
- `Select` also binds `number` fields that have options.
- `Field`, `Column`, and generated sheets pick a `Select` for a field with options (so the Lores rank column becomes a
  dropdown).
- Free-input tags bound to a field with options are an **error** (decided): `Text` and `Number` with a `field` (also as
  overrides), `Markdown`, `Image`: "This field has options; use Select or Field." Formula-only tags are unaffected.
- Display (decided: **labels**): wherever a choice value shows as text — view mode, `display="text"`, `Value` and
  `Column` bound by `field`, `{path}` interpolation — it shows the option's label. `display="box"` shows the disabled
  `Select` with the label. Formulas, including `{= path}`, always see the stored value. A formula's result is never
  relabeled.
- Sample data (`shared/sheet/editor.ts`) uses the first option.

### Schema builder
- String and number rows get an **Options** section (off by default): rows of value + label, reorderable, with add and
  remove. `builderErrors`: empty or duplicate values, numbers that don't parse. Round trips keep options and their order.
- Switching a field between string and number keeps the option rows (per the builder's "keep all settings" rule) but
  number values must parse to save.

## B. Tables over fixed rows

### Repeating over a struct (decided)
- `List` and `Table` also bind a `struct`. Rows are the struct's **schema entries in schema order**, not the data's
  keys, so all of them show even before the data has them. No add, remove, or reorder controls; `addLabel` on a struct
  `List` is a warning (`flag-no-effect`-style). Edits write through `setSheetValue`, which already creates the missing
  objects on the way.
- Entries must all be alike: either all `struct`s (each row's scope is that entry; `Table` needs this) or all the same
  primitive type with the same options (only `field="."` and formulas inside, like an array of primitives). Mixed entries
  are an error. `content`, `array`, and `object` entries are out of scope for now.
- In a struct `Table`/`List`, a relative path must resolve in **every** entry with the same type (same binding rules as
  today, checked per entry; the message names the first entry that fails).
- `RowDetails` works on struct tables.
- Free-form `object` fields and non-strict extra keys are never iterated: rows come from the schema only.

### Row key and label in formulas (decided: functions)
- `itemKey()`: the innermost row's entry key (`'acrobatics'`); in an array row, its index (0-based number).
- `itemLabel()`: the entry's schema `label`, else the humanized key ("Acrobatics"); in an array row, nothing.
- Both are errors outside a row (`formula-no-item`, checked statically); inside a per-item function (`sum(list, expr)`)
  they refer to that function's item. They're added to `formulaLaterBuiltins`, so an existing `<Define>` with the same
  name keeps working with a warning.
- Field tags with `field="."` in a struct row default their label to the entry's label, so
  `<List field="attributes" layout="grid" cols="6"><Number field="." format="signed" variant="stat" /></List>` labels
  each one "Str", "Dex", … from the schema.
- Per-row constants (each skill's attribute) come from a `<Define>`:
  ```xml
  <Define name="skillAttr" params="s" formula="switch(s, 'acrobatics', 'dex', 'arcana', 'int', …)" />
  <Table field="skills">
    <Column formula="itemLabel()" label="Skill" />
    <Column field="rank" />
    <Column label="Bonus" format="signed" formula="check(skillAttr(itemKey()), rank)" />
  </Table>
  ```
  Stored per-entry values (with schema defaults) can replace this later, once "Default values in schemas" exists.

### Aggregates over structs
- `sum`, `count`, `any`, `all` (and `min`/`max`/`join` over a list) accept a path to a schema `struct` too, iterating
  its schema entries in order like a struct `Table` (missing entries are nothing, or an empty scope for struct entries).
  The evaluator doesn't know the schema, so the validator compiles the entry keys into the call when it resolves the
  path; a path whose type is unknown (free-form object, non-strict extra key) isn't iterated. Example:
  `count(skills, rank >= 1)`. Steps count per entry like list items.

### Generated sheets
- A struct whose entries are all structs with the same primitive-only fields becomes a `Table` (with an `itemLabel()`
  column) instead of a `Section` per entry. A struct of same-type primitives keeps its `Grid` of `Field`s.

## Later (not in these PRs)
- An `optionLabel(path)` formula function, for building text like "Expert Athletics".
- A warning when a formula compares a choice field with a literal that isn't one of its options.
- A `Table` that combines a struct's fixed rows with an array's rows (PF2e skills followed by Lores).
- Iterating `content`/`array` struct entries.
