# Reference previews

Decided with the user on 2026-10-06. Gap 6 of the PF2e sheet mockup ([spec](../mockups/pf2e-sheet/spec.md), "States": a 340px card at the bottom right with the referenced content's rules text).

## Decisions

- **Default card, then override.** The card a referenced item shows comes from its content type's sheet; a referencing sheet can replace it in one place by writing the card as children of the tag that opens it (paths inside are relative to the referenced item, like a List row).
- **A separate card layout, not the whole sheet.** A content-type sheet may have a `<Card>` beside its `<Sheet>` root: shown only in previews, never on the content's own page. Without one, the card is generated from the schema: name, then tag fields (traits), then Markdown fields (description).
- **`<Sheet>` is required** (so `<Card>` can sit beside it at the top level, with `<Define>`s shared by both).
- **Limits:** cards are always read-only, and a card can't open another card.
- **Loading:** the content GET already sends referenced content's data (`refs`), not its type's sheet. The `<Card>` layout is fetched when a card first opens (once per content type, then cached); if the viewer can't read that sheet, the generated card is used. A default card is styled by its own sheet's CSS, an override by the referencing sheet's.

## Steps (one PR each)

1. Require the `<Sheet>` root (#96, merged).
2. Previews with the generated card and overrides (no fetching). Enough for the PF2e demo. (#97, open.)
3. `<Card>` in content-type sheets, fetched on first open.

- **Triggers** (user, 2026-10-06): `preview` on `Ref`, and on `Value`/`Column` when the field is reached through a content field (`spell.name` previews `spell`), which is how the mockup's tables show names.
- **Override syntax** (user, 2026-10-06): a `<Card>` child on the `preview` tag, not bare children (a `Value`'s or `Column`'s children are already `Part`s and `Button`s). Same tag name as step 3's `<Card>` beside `<Sheet>`.
- **Generated card body** (user, 2026-10-06): the schema has no Markdown type, so after the name and tag chips come label/value rows for other fields with a value, then text that is long (over 120 characters) or multi-line as Markdown.
