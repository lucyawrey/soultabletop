# Improvements

- Implement the content/content-type/sheet system: user-written sheet markup rendered as Nuxt UI character and content sheets. Design and phases: `docs/sheet-system.md` (phases 1–5 done: groundwork, parser, tag registry + validator, generator, view-mode rendering).
- Have all copy pull from an external data file for sharing across pages and easy updating.
- TypeBox based OpenAPI generation (low priority)
- Group invite approval (low priority): when a non-site-admin adds someone to a Group, create a pending invite the invited user must accept instead of adding them directly. Site admins can still add users directly. Currently `POST /api/group/[id]/members` adds immediately.
