export interface OwnerGroup {
  id: string;
  name: string;
  kind: "user" | "system";
  // null: a system group the user (a site admin) isn't in.
  role: "admin" | "editor" | "member" | null;
}

// Groups the signed-in user can create resources for: those where they're an
// admin or editor, plus system groups for a site admin outside them (the
// server's rule, `resolveResourceOwner`). Shared by key between the Owner
// field and the "working as" switch.
export function useOwnerGroups() {
  const { data, status } = useLazyFetch<OwnerGroup[]>("/api/group", {
    key: "owner-groups",
    default: () => [],
  });
  const groups = computed(() =>
    data.value.filter(
      (item) =>
        item.role === "admin" ||
        item.role === "editor" ||
        (item.kind === "system" && item.role === null),
    ),
  );
  return { groups, status };
}
