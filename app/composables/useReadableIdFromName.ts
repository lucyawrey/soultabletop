import { toReadableId, getReadableIdError } from "~/utils/readable-id";

// `key` names the field in readable-ID format (e.g. "username" on the signup form).
// `prefix`, if given, starts the generated ID (a system's prefix, see
// `useSystemIdPrefix`); the ID follows it too until the user edits the ID.
export function useReadableIdFromName<K extends string = "readableId">(
  form: { name: string } & Record<NoInfer<K>, string>,
  key: K = "readableId" as K,
  prefix?: () => string | undefined,
) {
  const readableIdTouched = ref(false);
  const readableIdError = computed(() => getReadableIdError(form[key]));

  function generate(name: string, start: string | undefined) {
    const fromName = toReadableId(name);
    if (!fromName) return "";
    // A name that already starts with the prefix ("Pf2e Fighter") keeps one.
    if (!start || fromName === start || fromName.startsWith(`${start}-`)) return fromName;
    return toReadableId(`${start}-${fromName}`);
  }

  watch(
    () => [form.name, prefix?.()] as const,
    ([name, start]) => {
      if (!readableIdTouched.value) form[key] = generate(name, start) as typeof form[K];
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
