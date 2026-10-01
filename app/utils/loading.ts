// True until a fetch has settled: its `status` is still "idle" or "pending".
// Use it to show skeletons instead of empty states (never on `data` alone).
export function isLoading(status: string | undefined) {
  return status === "pending" || status === "idle";
}
