import { getReadableIdError } from "~/utils/readable-id";

export type AvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "failed";

interface AvailabilityRequest {
  endpoint: string;
  query: Record<string, string>;
}

// Debounced live check of whether a readable ID (or username) is free.
// `request` returns what to ask the server, or null when there is nothing to
// check (empty, malformed, or unchanged). The server stays the authority: create
// and update still return 409 on a conflict.
export function useReadableIdAvailability(
  request: () => AvailabilityRequest | null,
) {
  const status = ref<AvailabilityStatus>("idle");
  const key = computed(() => JSON.stringify(request()));
  let timer: ReturnType<typeof setTimeout> | undefined;

  watch(key, (current) => {
    clearTimeout(timer);
    const req = request();
    if (!req) {
      status.value = "idle";
      return;
    }
    status.value = "checking";
    timer = setTimeout(async () => {
      try {
        const result = await $fetch<{ available: boolean }>(req.endpoint, {
          query: req.query,
        });
        // Ignore a result for something edited since.
        if (current !== key.value) return;
        status.value = result.available ? "available" : "taken";
      } catch {
        if (current === key.value) status.value = "failed";
      }
    }, 350);
  });
  onBeforeUnmount(() => clearTimeout(timer));

  return status;
}

export type ResourceIdKind =
  | "system"
  | "campaign"
  | "contentType"
  | "sheet"
  | "content"
  | "group";

// For Resource and group forms. `form.ownerGroupId` (null: the user) is the
// owner being picked. When editing, pass the saved values: the check is skipped
// while the ID and owner are unchanged, and the server then leaves the item
// itself out of the lookup.
export function useResourceIdAvailability(
  form: { readableId: string; ownerGroupId?: string | null },
  kind: ResourceIdKind,
  editing?: () => { id: string; readableId: string; ownerGroupId?: string | null } | undefined,
) {
  return useReadableIdAvailability(() => {
    const readableId = form.readableId.trim().toLowerCase();
    if (!readableId || getReadableIdError(readableId)) return null;
    const saved = editing?.();
    const query: Record<string, string> = { kind, readableId };
    if (saved) query.resourceId = saved.id;
    if (kind !== "group") {
      const ownerChanged = !saved || (form.ownerGroupId ?? null) !== (saved.ownerGroupId ?? null);
      if (saved && !ownerChanged && readableId === saved.readableId.toLowerCase())
        return null;
      if (ownerChanged) query.owner = form.ownerGroupId ?? "me";
    } else if (saved && readableId === saved.readableId.toLowerCase()) {
      return null;
    }
    return { endpoint: "/api/readable-id-availability", query };
  });
}
