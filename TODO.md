# Improvements

- Plan out the very complicated content/content-type/sheet system involving custom rendering per sheet object with user generated markup that needs to convert to nice looking NuxtUI compatable character and content sheets. Then, impliment it.
- Have all copy pull from an external data file for sharing across pages and easy updating.
- TypeBox based OpenAPI generation (low priority)
- Group invite approval (low priority): when a non-site-admin adds someone to a Group, create a pending invite the invited user must accept instead of adding them directly. Site admins can still add users directly. Currently `POST /api/group/[id]/members` adds immediately.
