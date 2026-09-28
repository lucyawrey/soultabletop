# Improvements

- Sheet system follow-ups (design in `docs/sheet-system.md`, phase 9): formulas (a safe expression language for computed values), image uploads, dice-roll buttons, dark-mode syntax colors in the Sheet editor, and a ContentType schema editor that isn't raw JSON.
- Have all copy pull from an external data file for sharing across pages and easy updating.
- TypeBox based OpenAPI generation (low priority)
- Group invite approval (low priority): when a non-site-admin adds someone to a Group, create a pending invite the invited user must accept instead of adding them directly. Site admins can still add users directly. Currently `POST /api/group/[id]/members` adds immediately.
