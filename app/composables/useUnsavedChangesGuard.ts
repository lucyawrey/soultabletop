import type { Ref } from "vue";

// Asks before leaving the page (in-app navigation or closing the tab) while
// `dirty` is true.
export function useUnsavedChangesGuard(dirty: Ref<boolean>) {
  onBeforeRouteLeave(() =>
    dirty.value
      ? window.confirm("You have unsaved changes. Leave anyway?")
      : true,
  );
  const warnOnUnload = (event: BeforeUnloadEvent) => {
    if (dirty.value) event.preventDefault();
  };
  onMounted(() => window.addEventListener("beforeunload", warnOnUnload));
  onBeforeUnmount(() => window.removeEventListener("beforeunload", warnOnUnload));
}
