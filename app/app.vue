<script setup>
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
        <UButton to="/campaigns" color="neutral" variant="link">Campaigns</UButton>
        <UButton to="/characters" color="neutral" variant="link">
          Characters
        </UButton>
        <UButton to="/content" color="neutral" variant="link">
          Content
        </UButton>
        <UButton to="/sheets" color="neutral" variant="link">Sheets</UButton>
        <UButton to="/types" color="neutral" variant="link">
          Types
        </UButton>
        <UButton to="/systems" color="neutral" variant="link"
          >Systems</UButton
        >
        <UButton to="/groups" color="neutral" variant="link">
          Groups
        </UButton>
      </template>

      <template #body>
        <nav class="flex flex-col gap-2">
          <UButton to="/campaigns" color="neutral" variant="link">Campaigns</UButton>
          <UButton to="/characters" color="neutral" variant="link">
            Characters
          </UButton>
          <UButton to="/content" color="neutral" variant="link">
            Content
          </UButton>
          <UButton to="/sheets" color="neutral" variant="link">Sheets</UButton>
          <UButton to="/types" color="neutral" variant="link">
            Types
          </UButton>
          <UButton to="/systems" color="neutral" variant="link"
            >Systems</UButton
          >
          <UButton to="/groups" color="neutral" variant="link">
            Groups
          </UButton>
        </nav>
      </template>

      <template #right>
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
