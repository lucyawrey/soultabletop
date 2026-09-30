// Whether someone is signed in. Pages that logged-out visitors can open use it
// to hide what needs an account (e.g. "New ..." buttons).
export async function useLoggedIn() {
  const session = await useAuthSession();
  return computed(() => !!session.data.value?.user);
}
