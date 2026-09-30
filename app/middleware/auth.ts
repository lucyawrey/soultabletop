export default defineNuxtRouteMiddleware(async (to) => {
  const session = await useAuthSession();
  if (!session.data.value?.user) {
    return navigateTo(signInRoute(to.fullPath));
  }
});
