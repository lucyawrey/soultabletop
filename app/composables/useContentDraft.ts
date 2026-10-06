import type { Ref } from "vue";
import { extractApiErrorMessage } from "~/utils/api-error";

interface DraftSource {
  id: string;
  name: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

interface SavedContent {
  name: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

export type DraftStatus = "idle" | "saving" | "saved" | "error" | "conflict";

const AUTOSAVE_DELAY_MS = 800;

// JSON with object keys sorted: content.data is jsonb, which doesn't keep key
// order, so plain JSON.stringify would see changes that aren't there.
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : item,
  );
}

// An editable copy of a Content's data (with its built-in `name`), saved with
// `expectedUpdatedAt` so concurrent edits are detected (409 -> "conflict").
// With `liveEdits` on (Edit off: only `live` fields can change), each change
// saves after the same pause as autosave, whatever the Autosave setting.
// See docs/sheet-system.md, section 5.
export function useContentDraft(
  source: Ref<DraftSource | null | undefined>,
  autosave: Ref<boolean>,
  liveEdits: Ref<boolean> = ref(false),
) {
  const draft = ref<Record<string, unknown>>({});
  // stableJson of the last saved (or loaded) draft.
  const baseline = ref("{}");
  // The last saved (or loaded) draft itself, for Discard.
  let saved: Record<string, unknown> = {};
  const expectedUpdatedAt = ref<string>();
  const status = ref<DraftStatus>("idle");
  const error = ref("");

  const dirty = computed(() => stableJson(draft.value) !== baseline.value);

  function reset() {
    const current = source.value;
    if (!current) return;
    draft.value = structuredClone({ ...toRaw(current.data), name: current.name });
    saved = structuredClone(toRaw(draft.value));
    baseline.value = stableJson(draft.value);
    expectedUpdatedAt.value = current.updatedAt;
    status.value = "idle";
    error.value = "";
  }

  // Take new server data unless there are unsaved changes (a save's own
  // response already matches the baseline, so it doesn't replace the draft).
  watch(
    () => source.value?.updatedAt,
    () => {
      const current = source.value;
      if (!current || dirty.value) return;
      const incoming = stableJson({ ...toRaw(current.data), name: current.name });
      if (incoming !== baseline.value) reset();
      else expectedUpdatedAt.value = current.updatedAt;
    },
    { immediate: true },
  );

  let saving: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function save(overwrite = false) {
    if (saving) await saving;
    const current = source.value;
    if (!current || (!dirty.value && !overwrite)) return;
    const { name, ...data } = structuredClone(toRaw(draft.value));
    const snapshot = stableJson(draft.value);
    status.value = "saving";
    error.value = "";
    saving = (async () => {
      try {
        const response = await $fetch<SavedContent>(`/api/content/${current.id}`, {
          method: "PATCH",
          body: {
            name,
            data,
            ...(overwrite ? {} : { expectedUpdatedAt: expectedUpdatedAt.value }),
          },
        });
        baseline.value = snapshot;
        saved = { ...structuredClone(data), name };
        expectedUpdatedAt.value = String(response.updatedAt);
        current.name = response.name;
        current.data = response.data;
        current.updatedAt = String(response.updatedAt);
        status.value = "saved";
      } catch (caught) {
        const statusCode = (caught as { statusCode?: number }).statusCode;
        status.value = statusCode === 409 ? "conflict" : "error";
        error.value = extractApiErrorMessage(caught, "Could not save.");
      }
    })();
    await saving;
    saving = undefined;
  }

  function discard() {
    draft.value = structuredClone(saved);
    status.value = "idle";
    error.value = "";
  }

  // A live change is waiting to be saved (or being saved) without autosave.
  const liveSaving = ref(false);

  // Autosave after a pause in changes; paused while there's a conflict. Turning
  // Edit off doesn't save: only a change made with Edit off does.
  watch(
    [draft, autosave],
    () => {
      clearTimeout(timer);
      const live = !autosave.value && liveEdits.value;
      if (!(autosave.value || live) || !dirty.value || status.value === "conflict") {
        liveSaving.value = false;
        return;
      }
      liveSaving.value = live;
      const mine = setTimeout(async () => {
        await save();
        // A newer change may have started its own wait meanwhile.
        if (timer === mine) liveSaving.value = false;
      }, AUTOSAVE_DELAY_MS);
      timer = mine;
    },
    { deep: true },
  );
  onBeforeUnmount(() => clearTimeout(timer));

  useUnsavedChangesGuard(dirty);

  return { draft, dirty, liveSaving, status, error, save, discard, reset };
}
