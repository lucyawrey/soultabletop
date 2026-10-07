# Fork resources

"Make my own copy" of a resource you can read, alone or with its parents. TODO item: "Fork resources" in Next up.

## Decisions (user, 2026-10-07)

- **Kinds in the first PR:** sheet, content type, system. Content and campaign forks come later.
- **Source link:** every copy stores its immediate source (`forkedFromId`: what was copied, not the root of the chain). It is a plain UUID, not a foreign key, so a deleted source leaves the link in place and the page shows "Forked from a resource that's no longer available" (pairs with the library's placeholders). A readable source shows as a link; an unreadable one is shown like a deleted one.
- **Parents, same author only:** "author" is the owner (user or group). Forking with parents walks up sheet → content type → system and stops at the first parent with a different owner (a community sheet on an official type copies only the sheet). Each copy points at its copied parent; the rest stay on the originals.
- **The user picks extras:** when a system is copied, the dialog lists that system's other content types and sheets with the same owner, checked by default. References among copied resources (content fields' `contentTypeId`, sheets' content type) are repointed to the copies; references to anything not copied stay on the originals. Content (feats, spells, characters) is never copied.

## Agent defaults (not yet confirmed by the user)

- The fork dialog asks for the owner (you or a group you can edit in, the usual owner field); names and readable IDs are kept, with a numeric suffix where the readable ID is taken under the new owner.
- Copies start Limited; grants, campaign members, and moderation state are not copied.
- A copied sheet keeps its default flag only when its content type is copied too; a lone sheet fork is never the default (its type is the original's).
- One endpoint does the whole copy in a transaction; a GET returns the chain and the extras for the dialog.
