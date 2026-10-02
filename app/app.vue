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
  // A section stays current on its detail and edit pages (`/systems/<id>`),
  // which are sibling routes, not children, of its list page.
  // `aria-label` names the link when the collapsed rail shows only its icon
  // (the tooltip appears on hover alone).
  const link = (to: string, label: string, icon: string) => ({
    to,
    label,
    icon,
    "aria-label": label,
    active: route.path === to || route.path.startsWith(`${to}/`),
  });
  const characters = link("/characters", "Characters", "i-lucide-user");
  const content = link("/content", "Content", "i-lucide-message-square");
  const sheets = link("/sheets", "Sheets", "i-lucide-table-2");
  const types = link("/types", "Types", "i-lucide-shapes");
  const systems = link("/systems", "Systems", "i-lucide-globe");
  if (!loggedIn.value)
    return [
      { label: "Browse", items: [content, characters, sheets, types, systems] },
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

// The signed-out landing page already has the sign-in form, so its sidebar has
// no Sign in button.
const showSignIn = computed(() => !loggedIn.value && route.path !== "/");

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
    <!-- A fixed 232px sidebar, as in the mockup. The storage key is new so a
         size saved under the old percent widths isn't read as pixels. -->
    <UDashboardGroup unit="px" storage-key="sidebar" class="print:block print:h-auto">
      <UDashboardSidebar
        v-model:collapsed="collapsed"
        collapsible
        :min-size="232"
        :default-size="232"
        :max-size="232"
        class="print:hidden"
        role="navigation"
        aria-label="Sidebar"
        :ui="{
          root: 'bg-default border-e border-default',
          // A wrapping row: the brand line (with the drawer's close button on
          // phones), then the system picker on a line of its own.
          header: 'h-auto flex-wrap items-center gap-x-1.5 gap-y-[18px] px-3.5 pt-[18px] pb-0',
          body: 'gap-[18px] px-3.5 pt-[18px]',
          // Empty on the signed-out landing page, so hidden there.
          footer: loggedIn || showSignIn ? 'mx-3.5 border-t border-default px-0 py-2.5' : 'hidden',
        }"
      >
        <template #header="{ collapsed: isCollapsed }">
          <div
            class="flex min-w-0 flex-1 items-center gap-2"
            :class="isCollapsed ? 'justify-center' : 'justify-between'"
          >
            <NuxtLink
              v-if="!isCollapsed"
              to="/"
              class="-m-1 flex items-center gap-2 rounded-md p-1 font-semibold whitespace-nowrap text-highlighted focus-visible:outline-3 focus-visible:outline-primary/25"
            >
              <UIcon name="i-lucide-dices" class="size-[22px] text-primary" />
              <span class="font-display text-xl leading-none font-bold">Soul Tabletop</span>
            </NuxtLink>
            <!-- One toggle for both states; phones use the drawer instead.
                 Negative margins keep the row the brand's 22px, as in the
                 mockup. -->
            <UButton
              class="-my-1.5 hidden lg:inline-flex"
              color="neutral"
              variant="ghost"
              size="sm"
              :icon="isCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
              :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
              :aria-expanded="!isCollapsed"
              @click="collapsed = !collapsed"
            />
          </div>
          <!-- In the header, not the scrolling body, which would clip it: on
               desktop it pokes past the sidebar's edge into the page, like a
               bookmark (the mockup). The drawer on phones keeps it inside. -->
          <SystemSelector
            v-if="!isCollapsed"
            class="relative z-10 shrink-0 basis-full lg:basis-[calc(100%+1.375rem)]"
          />
        </template>

        <template #default="{ collapsed: isCollapsed }">
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
            v-if="showSignIn"
            to="/"
            color="primary"
            :block="!isCollapsed"
            icon="i-lucide-log-in"
            :aria-label="isCollapsed ? 'Sign in' : undefined"
            :label="isCollapsed ? undefined : 'Sign in'"
          />
          <UserMenu v-else-if="loggedIn" :collapsed="isCollapsed" />
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
            <span class="font-display text-xl leading-none font-bold">Soul Tabletop</span>
          </NuxtLink>
        </div>
        <NuxtPage />
      </main>
    </UDashboardGroup>
  </UApp>
</template>
