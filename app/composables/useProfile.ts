export interface Profile {
  username: string;
  iconImageUrl: string | null;
  role: "admin" | "member";
}

// The signed-in user's profile (`GET /api/profile`), or null when logged out.
// Shared by key, so the header's user menu and the profile page read the same
// data: refreshing it after a save updates the header too. Refetched when the
// signed-in user changes. Takes the caller's signed-in user ID rather than
// awaiting the session itself, since an await here would lose the component
// instance.
export function useProfile(userId: () => string | undefined) {
  // Forwards the request's cookies during SSR, unlike plain $fetch.
  const requestFetch = useRequestFetch();
  return useAsyncData(
    "profile",
    () =>
      userId() ? requestFetch<Profile>("/api/profile") : Promise.resolve(null),
    { watch: [userId] },
  );
}
