import { slugify, getSlugError } from "~/utils/slug";

// `key` names the slug-formatted field (e.g. "username" on the signup form).
export function useSlugFromName<K extends string = "slug">(
  form: { name: string } & Record<NoInfer<K>, string>,
  key: K = "slug" as K,
) {
  const slugTouched = ref(false);
  const slugError = computed(() => getSlugError(form[key]));

  watch(
    () => form.name,
    (name) => {
      if (!slugTouched.value) form[key] = slugify(name) as typeof form[K];
    },
  );

  function onSlugInput(value: string | number) {
    form[key] = String(value) as typeof form[K];
    slugTouched.value = true;
  }

  function resetSlugTouched(touched = false) {
    slugTouched.value = touched;
  }

  return { onSlugInput, resetSlugTouched, slugError };
}
