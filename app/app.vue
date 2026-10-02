<script setup>
useHead({
  meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
  link: [{ rel: "icon", href: "/favicon.ico" }],
  htmlAttrs: {
    lang: "en",
  },
});

const { title, description } = copy.site;

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
        <SystemSelector class="mb-2 w-full" />
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
        <SystemSelector class="hidden lg:flex" />
        <UButton
          v-if="!loggedIn"
          to="/"
          color="neutral"
          variant="outline"
          size="sm"
        >
          Sign in
        </UButton>
        <UserMenu v-else />
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
