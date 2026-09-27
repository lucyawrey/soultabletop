export default defineNuxtRouteMiddleware(async () => {
  const session = await useAuthSession();
  if (!session.data.value?.user) {
    return navigateTo("/");
  }
});
