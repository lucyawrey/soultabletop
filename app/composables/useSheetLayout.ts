export type SheetLayout = "columns" | "stacked";

// How the Sheet editor and a sheet's page arrange its code and its preview on
// wide screens: side by side, or the code above the preview (more room for
// both). One choice for both pages, kept in a cookie like `useListView`, so
// the server renders it and there is no hydration mismatch.
export function useSheetLayout() {
  const cookie = useCookie<string | null>("sheet-layout", {
    default: () => null,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return computed<SheetLayout>({
    get: () => (cookie.value === "stacked" ? "stacked" : "columns"),
    set: (value) => {
      cookie.value = value;
    },
  });
}
