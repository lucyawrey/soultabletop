# Checking a Sheet

The check runs the same code the server and the editor run: `compileSheet` (parse plus validate, `shared/sheet/validate.ts`)
and `processSheetCss` (`shared/sheet/css.ts`). A Sheet with any error diagnostic cannot be saved. It needs the repo
checked out with dependencies installed; it does not need the database.

## Inputs

Put three files in a folder outside the repo (for example a scratch directory):

- `sheet.stts`: the markup.
- `sheet.css`: the CSS (may be empty).
- `schemas.json`: what the validator knows about the content type, shaped like `SheetSchemas`:

```json
{
  "root": {
    "hasStrictSchema": true,
    "schema": { "level": { "type": "number", "required": true } }
  },
  "types": {
    "<contentTypeId of a referenced type>": { "hasStrictSchema": true, "schema": { } }
  }
}
```

`root.schema` is the content type's `schema` (from `GET /api/content-type/[id]`, or the content type page's JSON
view). `hasStrictSchema` is that content type's flag (strict: unknown paths are errors; not strict: warnings).
`types` holds the schema of every content type reachable through `content` fields, keyed by content type ID, up to 3
hops; leave it `{}` if there are none. If a `content` field's type is missing from `types`, using paths through it gives
a `missing-content-type` warning and is not checked.

## The check

Create a temporary test file inside the repo (vitest only collects `shared/**` and `server/**` tests), run it, then
delete it. Do not commit it. Set `SHEET_DIR` to the folder above.

`shared/sheet/check-sheet.tmp.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { processSheetCss } from "./css";
import { compileSheet, hasErrors, type SheetSchemas } from "./validate";

const dir = process.env.SHEET_DIR!;
const read = (name: string) => readFileSync(join(dir, name), "utf8");

test("sheet compiles", () => {
  const schemas = JSON.parse(read("schemas.json")) as SheetSchemas;
  const markup = compileSheet(read("sheet.stts"), schemas).diagnostics;
  // Pass a scope ID to also get the scoped CSS; without one it only checks.
  const css = processSheetCss(read("sheet.css")).diagnostics;
  const lines = [
    ...markup.map((d) => `markup ${d.loc.start.line}:${d.loc.start.column} ${d.severity} ${d.code}: ${d.message}`),
    ...css.map((d) => `css ${d.loc.start.line}:${d.loc.start.column} ${d.severity} ${d.code}: ${d.message}`),
  ];
  console.log(lines.join("\n") || "no diagnostics");
  expect(hasErrors([...markup, ...css])).toBe(false);
});
```

Run it from the repo root with output shown (the project's Node and pnpm only work through a zsh login shell):

```sh
zsh -ilc 'nvm use >/dev/null 2>&1 && SHEET_DIR=/path/to/folder pnpm exec vitest run shared/sheet/check-sheet.tmp.test.ts --disableConsoleIntercept' 2>&1 | grep -v "command not found"
rm shared/sheet/check-sheet.tmp.test.ts
```

The test passes when there are no errors; read the printed warnings as well. Diagnostic locations are 1-based line and
column in the file. To also see how the CSS is scoped, call `processSheetCss(css, "some-id")` and print `.css`.

## Dump the registry

To list every tag with its attributes as JSON (to regenerate or double-check `tags.md`), use a temporary test that
imports `sheetTags` and `commonAttrs` from `./registry` and prints `JSON.stringify([...sheetTags.values()], null, 2)`.

## Other ways to check

- The Sheet editor's Problems list (errors and warnings; click one to jump to the line) and its live preview, with the sample data picker.
- The repo's own test suite (`pnpm test`) covers the parser, validator, generator, and CSS; run it after changing anything in `shared/sheet/`.

## What the check does not cover

- It does not render anything: layout and looks need the editor preview.
- It does not check data against Select `options`, or that a referenced content exists.
- Warnings are not errors, but read them: an unknown path in a non-strict schema is a warning and shows an empty value.
