# Tag reference

Compact summary of `shared/sheet/registry.ts` (the source of truth; if this file and the registry disagree, the
registry wins). To print the live registry as JSON, run the dump script in `checking.md`.

Enum values are written `a | b`; the first listed is not necessarily the default (defaults are in the notes).
Attributes marked (req) are required. Tag and attribute names are case-insensitive.

## Attributes every tag accepts

`Tab` and `RowDetails` are rendered by their parents (`Tabs`, `Table`), so they accept only `class` from this list; `live`, `locked`, and `display` there are an unknown-attribute error.

| Attribute | Values | Meaning |
|---|---|---|
| `class` | space-separated names, each `[a-z][a-z0-9-]*` | Class names for the Sheet's CSS |
| `live` | bare, `true`, `false` | Fields inside stay editable with Edit off |
| `locked` | bare, `true`, `false` | Fields inside need their pencil button clicked before editing |
| `display` | `text` \| `box` | How non-editable fields look: plain value, or their disabled input |

## Layout tags

| Tag | Attributes | Children | Notes |
|---|---|---|---|
| `Sheet` | none | any | Optional root; top level only |
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

`color` values: `primary | secondary | success | info | warning | error | neutral`. `icon` is an Iconify name that
matches `i-<set>-<name>`, for example `i-lucide-sword`. "text" children means text with `{path}` interpolation and no tags.

## Field tags

All field tags take `field` (req; a path, see SKILL.md), `label`, `hideLabel` (boolean: no visible label; `Column` leaves its header empty; `label=""` does not do this), and `hint`, plus:

| Tag | Extra attributes | Binds | Notes |
|---|---|---|---|
| `Field` | none | string, number, boolean, scalar, object, resourceLink, content, array of strings | Input chosen from the schema type |
| `Text` | `multiline`, `placeholder` | string | |
| `Number` | `min`, `max`, `step`, `format` (`plain` \| `signed`), `variant` (`input` \| `stat`) | number | `stat`: large number, small label; `signed`: `+3` (also in the editable input; data stays numeric) |
| `Checkbox` | none | boolean | |
| `Toggle` | none | boolean | On/off switch |
| `Select` | `options` (req, comma-separated) | string | `options="Small, Medium, Large"` |
| `Tags` | none | array of strings | |
| `Tracker` | `max` (req, number >= 1 or one `{path}`), `style` (`bar` \| `pips`, default bar) | number | `max="{hp.max}"` |
| `Ref` | none | resourceLink, content | Link to the referenced resource or Content |
| `Value` | `format` (`plain` \| `signed`) | any value | Never editable |
| `Markdown` | none | string | Formatted long text |
| `Image` | `alt`, `size` (`sm` \| `md` \| `lg` \| `full`, default md) | string | The string must be an https URL |
| `Column` | `width` (`auto` \| `xs` \| `sm` \| `md` \| `lg`) | string, number, boolean, scalar, resourceLink, content | Only directly inside `Table`; its cells get `sheet-column` and its `class` |

Paths the schema does not know (a non-strict content type, or below a free-form `object`) are accepted by every
field tag, with a warning.

## Repeaters

| Tag | Attributes | Children | Binds |
|---|---|---|---|
| `List` | `field` (req), `label`, `layout` (`stack` \| `grid`), `cols` (1-12, for grid), `addLabel` (default "Add") | any; paths inside are relative to each item | any array |
| `Table` | `field` (req), `label` | only `Column` and `RowDetails`; paths inside are relative to each row | array of structs (also content or object items) |

In edit mode a `List` or `Table` gets add, remove, and reorder controls.
