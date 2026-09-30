import { toReadableId, getReadableIdError } from "~/utils/readable-id";

// `key` names the field in readable-ID format (e.g. "username" on the signup form).
export function useReadableIdFromName<K extends string = "readableId">(
  form: { name: string } & Record<NoInfer<K>, string>,
  key: K = "readableId" as K,
) {
  const readableIdTouched = ref(false);
  const readableIdError = computed(() => getReadableIdError(form[key]));

  watch(
    () => form.name,
    (name) => {
      if (!readableIdTouched.value) form[key] = toReadableId(name) as typeof form[K];
    },
  );

  function onReadableIdInput(value: string | number) {
    form[key] = String(value) as typeof form[K];
    readableIdTouched.value = true;
  }

  function resetReadableIdTouched(touched = false) {
    readableIdTouched.value = touched;
  }

  return { onReadableIdInput, resetReadableIdTouched, readableIdError };
}
