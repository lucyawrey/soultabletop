<script setup lang="ts">
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

// Play and Build need an account for Campaigns and Groups; the rest show
// public resources to logged-out visitors, who get one Browse group.
const loggedIn = await useLoggedIn();
const route = useRoute();
const navGroups = computed(() => {
  const link = (to: string, label: string, icon: string) => ({
    to,
    label,
    icon,
  });
  const characters = link("/characters", "Characters", "i-lucide-users");
  const content = link("/content", "Content", "i-lucide-book-open");
  const sheets = link("/sheets", "Sheets", "i-lucide-scroll-text");
  const types = link("/types", "Types", "i-lucide-shapes");
  const systems = link("/systems", "Systems", "i-lucide-library");
  if (!loggedIn.value)
    return [
      { label: "Browse", items: [characters, content, sheets, types, systems] },
    ];
  return [
    {
      label: "Play",
      items: [
        link("/campaigns", "Campaigns", "i-lucide-swords"),
        characters,
        content,
      ],
    },
    {
      label: "Build",
      items: [sheets, types, systems, link("/groups", "Groups", "i-lucide-users-round")],
    },
  ];
});
const menuItems = computed(() =>
  navGroups.value.map((group) => [
    { type: "label" as const, label: group.label },
    ...group.items,
  ]),
);

// The signed-out landing page already has the sign-in form, so it has no
// sidebar at all.
const showSidebar = computed(() => loggedIn.value || route.path !== "/");

// The sheet editor needs the width, so the sidebar starts collapsed there.
const isEditor = (path: string) => /^\/sheets\/[^/]+\/edit\/?$/.test(path);
const collapsed = ref(isEditor(route.path));
watch(
  () => isEditor(route.path),
  (editing) => (collapsed.value = editing),
);
</script>

<template>
  <UApp>
    <UDashboardGroup v-if="showSidebar" class="print:block print:h-auto">
      <UDashboardSidebar
        v-model:collapsed="collapsed"
        collapsible
        :collapsed-size="0"
        :min-size="14"
        :default-size="16"
        :max-size="22"
        class="print:hidden"
        :ui="{ footer: 'border-t border-default' }"
      >
        <template #header="{ collapse }">
          <div class="flex w-full items-center justify-between gap-2">
            <NuxtLink
              to="/"
              class="-ms-1 flex items-center gap-2 rounded-md p-1 font-semibold whitespace-nowrap text-highlighted focus-visible:outline-3 focus-visible:outline-primary/25"
            >
              <UIcon name="i-lucide-dices" class="size-5 text-primary" />
              <span>Soul Tabletop</span>
            </NuxtLink>
            <UButton
              class="hidden lg:inline-flex"
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-panel-left-close"
              aria-label="Collapse sidebar"
              @click="collapse(true)"
            />
          </div>
        </template>

        <SystemSelector class="w-full" />
        <UNavigationMenu
          :items="menuItems"
          orientation="vertical"
          aria-label="Main"
        />

        <template #footer>
          <UButton
            v-if="!loggedIn"
            to="/"
            color="primary"
            block
            icon="i-lucide-log-in"
          >
            Sign in
          </UButton>
          <UserMenu v-else />
        </template>
      </UDashboardSidebar>

      <main class="relative min-w-0 flex-1 overflow-y-auto print:overflow-visible">
        <!-- Phones: the sidebar is a drawer behind this bar's button. -->
        <div
          class="sticky top-0 z-10 flex items-center gap-2 border-b border-default bg-default p-2 lg:hidden print:hidden"
        >
          <UDashboardSidebarToggle />
          <NuxtLink
            to="/"
            class="flex items-center gap-2 rounded-md p-1 font-semibold text-highlighted focus-visible:outline-3 focus-visible:outline-primary/25"
          >
            <UIcon name="i-lucide-dices" class="size-5 text-primary" />
            <span>Soul Tabletop</span>
          </NuxtLink>
        </div>
        <UButton
          v-if="collapsed"
          class="absolute start-2 top-2 z-10 hidden lg:inline-flex print:hidden"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-panel-left-open"
          aria-label="Expand sidebar"
          @click="collapsed = false"
        />
        <NuxtPage />
      </main>
    </UDashboardGroup>
    <UMain v-else>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
