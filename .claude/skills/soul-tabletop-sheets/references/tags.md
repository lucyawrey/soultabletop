# Tag reference

Compact summary of `shared/sheet/registry.ts` (the source of truth; if this file and the registry disagree, the
registry wins). To print the live registry as JSON, run the dump script in `checking.md`.

Enum values are written `a | b`; the first listed is not necessarily the default (defaults are in the notes).
Attributes marked (req) are required. Tag and attribute names are case-insensitive.

## Attributes every tag accepts

`Tab` and `RowDetails` are rendered by their parents (`Tabs`, `Table`), so they accept only `class` and `show` from this list; `live`, `locked`, and `display` there are an unknown-attribute error. `Column` takes no `show` (put it on the `Table`, or use a formula in the column). `Button` takes only `class`, `show`, and `live`. `Define` and `Set` take none of these.

| Attribute | Values | Meaning |
|---|---|---|
| `class` | space-separated names, each `[a-z][a-z0-9-]*` | Class names for the Sheet's CSS |
| `live` | bare, `true`, `false` | Fields inside stay editable with Edit off |
| `locked` | bare, `true`, `false` | Fields inside need their pencil button clicked before editing |
| `display` | `text` \| `box` | How non-editable fields look: plain value, or their disabled input |
| `show` | a bare formula, like `hp > 0` | Shows the tag only when true; false or empty hides it and everything inside |

## Layout tags

| Tag | Attributes | Children | Notes |
|---|---|---|---|
| `Sheet` | none | any | Required root: every sheet is one, with only `Define`s beside it |
| `Section` | `title`, `description`, `icon`, `span` (1-12), `collapsible`, `collapsed` | any | A card. `span` is columns inside a `Grid`. `collapsed` implies `collapsible` |
| `Grid` | `cols` (1-12, default 2), `gap` (`none` \| `sm` \| `md` \| `lg`, default `md`) | any | One column on phones |
| `Stack` | `direction` (`row` \| `column`, default column), `gap`, `align` (`start` \| `center` \| `end` \| `stretch`), `wrap` | any | Flex container |
| `Tabs` | none | only `Tab` | |
| `Tab` | `label` (req), `icon` | any | Only directly inside `Tabs` |
| `Divider` | `label` | none | |
| `Heading` | `level` (1-4, default 1) | text | |
| `Note` | none | text | Muted text |
| `Callout` | `color`, `icon`, `title` | text | `color` default `info` |
| `Badge` | `color` | text | `color` default `primary` |
| `Collapsible` | `title` (req), `subtitle`, `icon`, `open` | any | Header shows or hides content |
| `RowDetails` | none | any | Only directly inside `Table`; shown when a row is expanded |

`color` values: `primary | secondary | success | info | warning | error | neutral`. `icon` is an Iconify name from Lucide or
game-icons.net, for example `i-lucide-sword` or `i-game-icons-crossed-swords` (browse them at lucide.dev and
game-icons.net); other icon sets are an error. "text" children means text with `{formula}`s and no tags.

## Field tags

All field tags take `field` (a path, see SKILL.md; required unless the tag has a `formula`), `label`, `hideLabel` (boolean: no visible label; `Column` leaves its header empty; `label=""` does not do this), and `hint`, plus:

| Tag | Extra attributes | Binds | Notes |
|---|---|---|---|
| `Field` | `formula` (only on a string, number, or boolean field; needs `field`) | string, number, boolean, scalar, object, resourceLink, content, array of strings | Input chosen from the schema type; with `formula` it acts like `Text`/`Number`/`Checkbox` (an override) |
| `Text` | `formula`, `multiline`, `placeholder` | string | `formula` overrides (see below) |
| `Number` | `formula`, `min`, `max`, `step`, `format` (`plain` \| `signed`), `variant` (`input` \| `stat`) | number | `stat`: large number, small label; `signed`: `+3` (also in the editable input; data stays numeric); `formula` overrides |
| `Checkbox` | `formula`, `style` (`check` \| `dot`, default check) | boolean | `formula` overrides; `style="dot"` is a filled or empty circle with no Yes/No text (proficiency marks) |
| `Toggle` | none | boolean | On/off switch |
| `Select` | `options` (comma-separated; only on a text field without schema options) | string, or number with schema options | `<Select field="size" />` (schema options) or `options="Small, Medium, Large"` |
| `Tags` | none | array of strings | |
| `Tracker` | `formula`, `max` (optional, number >= 0, or one `{formula}`), `style` (`bar` \| `pips`, default bar) | number | `max="{hp.max}"`; without `max` (or at 0) only the value shows; `formula` (read-only) computes the current value |
| `Ref` | `preview` (boolean) | resourceLink, content | Link to the referenced resource or Content; with `preview` (content fields only), clicking opens its card instead; may hold one `Card` |
| `Value` | `formula`, `format` (`plain` \| `signed`), `preview` (boolean) | any value | Never editable; `formula` (read-only) instead of `field`; with `Part` children and no formula, shows their sum; `preview` (see "Reference previews") |
| `Markdown` | none | string | Formatted long text |
| `Image` | `alt`, `size` (`sm` \| `md` \| `lg` \| `full`, default md) | string | The string must be an https URL |
| `Column` | `formula`, `format` (`plain` \| `signed`), `width` (`auto` \| `xs` \| `sm` \| `md` \| `lg`), `preview` (boolean) | string, number, boolean, scalar, resourceLink, content | Only directly inside `Table`; its cells get `sheet-column` and its `class`; `formula` (read-only) is computed per row; it may hold `Part` children (a breakdown; their sum without a formula) and `Button` children (each row gets them, after the value; a column of only Buttons is hidden from viewers who can't edit) |

`formula`: read-only on `Value`, `Column`, `Tracker` (instead of `field`; never both). On `Number`, `Text`, and
`Checkbox` it may stand alone (read-only) or go with `field` (an override: the field's value wins when it has one; the
computed value is the input's placeholder; a reset button clears the field). Outside `List`/`Table` rows, other
formulas reading an override's field with nothing stored get its computed value; `{path}` does too; a field tag shows the stored value. `live`/`locked` on a tag with a formula
and no field do nothing (a warning). `Field` takes `formula` with `field` on a string, number, or boolean schema field and then acts as the matching tag; any other schema type is an error. Other field tags take no `formula`.

Paths the schema does not know (a non-strict content type, or below a free-form `object`) are accepted by every
field tag, with a warning.

## Repeaters

| Tag | Attributes | Children | Binds |
|---|---|---|---|
| `List` | `field` (req), `label`, `layout` (`stack` \| `grid`), `cols` (1-12, for grid), `addLabel` (default "Add") | any; paths inside are relative to each item | any array, or a struct whose entries are alike |
| `Table` | `field` (req), `label` | only `Column` and `RowDetails`; paths inside are relative to each row | array of structs (also content or object items), or a struct of alike structs |

In edit mode a `List` or `Table` of an array gets add, remove, and reorder controls; one of a struct's entries has a row per schema entry and no controls.

## Breakdowns

| Tag | Attributes | Children | Notes |
|---|---|---|---|
| `Part` | `label` (req, text with `{…}`), `formula` (req, a number), `show` (no other common attributes) | none | Only directly inside `Value`, `Column`, or `Number` (a `Number` needs a `formula`). Clicking the number lists the parts in a popover; a `Value`/`Column` without a formula shows their sum. Parts that give nothing are left out |

## Reference previews

| Tag | Attributes | Children | Notes |
|---|---|---|---|
| `Card` | `class`, `show` only | any | Only directly inside a `Ref`, `Value`, or `Column` with `preview`, at most one: the card it opens, instead of the generated one (chips, rows, long text from the referenced content type). Paths inside are relative to the referenced content (`/` still reaches the top level); always read-only, so no `Button`s and no `preview` inside. Styled by this sheet's CSS |

`preview` opens the last content field on the way to the tag's field (`spell.name` previews `spell`; in a `Table` over an array of content, the row).

## Buttons

| Tag | Attributes | Children | Notes |
|---|---|---|---|
| `Button` | `label` (req), `icon`, `amount` (boolean), `toast` (boolean, off by default) | only `Set`, at least one | Shown only to viewers who can edit; with Edit off usable only if `live`. Adjacent Buttons with `amount` share one number box; `amount` in their `Set` formulas is the number typed. A click writes all `Set`s (computed from the data before it); with `toast`, a toast offers Undo. Errors always show a toast |
| `Set` | `field` (req; one text, number, true/false, or scalar field; one `*` segment for every item of an array or entry of a struct of alike entries), `formula` (req) | none | Only directly inside `Button`. With `*` the formula runs per item, paths relative to the item; nothing (`null`) removes the value; a literal written to a choice field must be an option |

## Definitions

| Tag | Attributes | Children | Notes |
|---|---|---|---|
| `Define` | `name` (req, identifier, not a built-in or reserved name), `params` (comma-separated, at most 8), `formula` (req) | none | Top level or directly inside `Sheet`; renders nothing; called as `name(args)` from any formula; order doesn't matter |
