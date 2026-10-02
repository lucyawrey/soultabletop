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
  const characters = link("/characters", "Characters", "i-lucide-user");
  const content = link("/content", "Content", "i-lucide-message-square");
  const sheets = link("/sheets", "Sheets", "i-lucide-table-2");
  const types = link("/types", "Types", "i-lucide-shapes");
  const systems = link("/systems", "Systems", "i-lucide-globe");
  if (!loggedIn.value)
    return [
      { label: "Browse", items: [characters, content, sheets, types, systems] },
    ];
  return [
    {
      label: "Play",
      items: [
        link("/campaigns", "Campaigns", "i-lucide-flag"),
        characters,
        content,
      ],
    },
    {
      label: "Build",
      items: [sheets, types, systems, link("/groups", "Groups", "i-lucide-users")],
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
                :min-size="14"
        :default-size="18"
        :max-size="22"
        class="print:hidden"
        :ui="{ root: 'bg-default border-e border-default', footer: 'border-t border-default' }"
      >
        <template #header="{ collapsed: isCollapsed }">
          <div
            class="flex w-full items-center gap-2"
            :class="isCollapsed ? 'justify-center' : 'justify-between'"
          >
            <NuxtLink
              v-if="!isCollapsed"
              to="/"
              class="-ms-1 flex items-center gap-2 rounded-md p-1 font-semibold whitespace-nowrap text-highlighted focus-visible:outline-3 focus-visible:outline-primary/25"
            >
              <UIcon name="i-lucide-dices" class="size-5 text-primary" />
              <span class="font-display text-xl leading-none font-bold">Soul Tabletop</span>
            </NuxtLink>
            <!-- One toggle for both states; phones use the drawer instead. -->
            <UButton
              class="hidden lg:inline-flex"
              color="neutral"
              variant="ghost"
              size="sm"
              :icon="isCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
              :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
              :aria-expanded="!isCollapsed"
              @click="collapsed = !collapsed"
            />
          </div>
        </template>

        <template #default="{ collapsed: isCollapsed }">
          <SystemSelector v-if="!isCollapsed" class="w-full" />
          <UNavigationMenu
            :items="menuItems"
            orientation="vertical"
            :collapsed="isCollapsed"
            tooltip
            aria-label="Main"
          />
        </template>

        <template #footer="{ collapsed: isCollapsed }">
          <UButton
            v-if="!loggedIn"
            to="/"
            color="primary"
            :block="!isCollapsed"
            icon="i-lucide-log-in"
            :aria-label="isCollapsed ? 'Sign in' : undefined"
            :label="isCollapsed ? undefined : 'Sign in'"
          />
          <UserMenu v-else :collapsed="isCollapsed" />
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
        <NuxtPage />
      </main>
    </UDashboardGroup>
    <UMain v-else>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
