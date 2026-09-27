# Improvements

- Plan out the very complicated content/content-type/sheet system involving custom rendering per sheet object with user generated markup that needs to convert to nice looking NuxtUI compatable character and content sheets. Then, impliment it.
- Have all copy pull from an external data file for sharing across pages and easy updating.
- Convert the dashboard into a welcome page that shows _recent_ games, characters, and content. Systems are not needed on the dashboard.
- TypeBox based OpenAPI generation (low priority, may not be worth it)

# Issues

- Slug fields when creating resources always have red outline as if they were errored even when there is not a formatting error and submitting works fine after. A formatting error means it does not match the established slug pattern in this project.
