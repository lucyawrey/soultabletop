import { slugify, getSlugError } from "~/utils/slug";

export function useSlugFromName(form: { name: string; slug: string }) {
  const slugTouched = ref(false);
  const slugError = computed(() => getSlugError(form.slug));

  watch(
    () => form.name,
    (name) => {
      if (!slugTouched.value) form.slug = slugify(name);
    },
  );

  function onSlugInput(value: string | number) {
    form.slug = String(value);
    slugTouched.value = true;
  }

  function resetSlugTouched(touched = false) {
    slugTouched.value = touched;
  }

  return { onSlugInput, resetSlugTouched, slugError };
}
