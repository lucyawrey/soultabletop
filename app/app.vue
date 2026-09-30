<script setup>
import { authClient } from "~/utils/auth-client";

useHead({
  meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
  link: [{ rel: "icon", href: "/favicon.ico" }],
  htmlAttrs: {
    lang: "en",
  },
});

const title = "Page title placeholder | Soul Tabletop";
const description = "Page description placeholder.";

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: "summary_large_image",
});

// Campaigns and Groups need an account; the rest show public resources to
// logged-out visitors.
const loggedIn = await useLoggedIn();
const navItems = computed(() =>
  [
    { to: "/campaigns", label: "Campaigns", account: true },
    { to: "/characters", label: "Characters" },
    { to: "/content", label: "Content" },
    { to: "/sheets", label: "Sheets" },
    { to: "/types", label: "Types" },
    { to: "/systems", label: "Systems" },
    { to: "/groups", label: "Groups", account: true },
  ].filter((item) => loggedIn.value || !item.account),
);

const toast = useToast();
const route = useRoute();
const signOutBusy = ref(false);
async function signOut() {
  signOutBusy.value = true;
  try {
    // Leave the page first: if it has unsaved changes and the user cancels
    // leaving, they stay signed in and can still save.
    await navigateTo("/");
    if (route.path !== "/") return;
    const result = await authClient.signOut();
    if (result.error) throw new Error(result.error.message);
    // Reload what the home page fetched, now as a logged-out visitor.
    await refreshNuxtData();
  } catch (error) {
    toast.add({
      title: "Could not sign out.",
      description: error instanceof Error ? error.message : undefined,
      color: "error",
    });
  } finally {
    signOutBusy.value = false;
  }
}
</script>

<template>
  <UApp>
    <UHeader :ui="{ root: 'bg-default' }">
      <template #left>
        <NuxtLink
          to="/"
          class="flex items-center gap-2 rounded-md p-1 -ms-1 font-semibold text-highlighted focus-visible:outline-3 focus-visible:outline-primary/25"
        >
          <UIcon name="i-lucide-dices" class="size-5 text-primary" />
          <span>Soul Tabletop</span>
        </NuxtLink>
      </template>

      <template #default>
        <UButton
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          color="neutral"
          variant="link"
        >
          {{ item.label }}
        </UButton>
      </template>

      <template #body>
        <nav class="flex flex-col gap-2">
          <UButton
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            color="neutral"
            variant="link"
          >
            {{ item.label }}
          </UButton>
        </nav>
      </template>

      <template #right>
        <UButton
          v-if="loggedIn"
          color="neutral"
          variant="outline"
          size="sm"
          :loading="signOutBusy"
          @click="signOut"
        >
          Sign out
        </UButton>
        <UButton v-else to="/" color="neutral" variant="outline" size="sm">
          Sign in
        </UButton>
        <UColorModeButton />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <USeparator />

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          Soul Tabletop © {{ new Date().getFullYear() }}
        </p>
      </template>
    </UFooter>
  </UApp>
</template>
