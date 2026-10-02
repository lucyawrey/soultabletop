export type ListView = "table" | "cards";

// Which view a list page shows. Kept in a cookie (one per page), not
// `localStorage`, so the server renders the chosen view and there is no
// hydration mismatch. `defaultView` applies until the user picks one.
export function useListView(pageKey: string, defaultView: ListView) {
  const cookie = useCookie<string | null>(`list-view-${pageKey}`, {
    default: () => null,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return computed<ListView>({
    get: () =>
      cookie.value === "table" || cookie.value === "cards"
        ? cookie.value
        : defaultView,
    set: (value) => {
      cookie.value = value;
    },
  });
}
