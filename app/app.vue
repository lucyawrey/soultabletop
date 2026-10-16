<script setup lang="ts">
useHead({
  meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
  // The sidebar logo's dice icon in the primary color; the .ico is the
  // fallback for browsers without SVG favicons.
  link: [
    { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    { rel: "icon", href: "/favicon.ico", sizes: "any" },
  ],
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
  ogSiteName: "Soul Tabletop",
  ogType: "website",
  // "summary_large_image" needs an og:image, which the site doesn't have yet.
  twitterCard: "summary",
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
    active: route.path === to || (to !== "/" && route.path.startsWith(`${to}/`)),
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
    { items: [link("/", "Dashboard", "i-lucide-house")] },
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
    ...(group.label ? [{ type: "label" as const, label: group.label }] : []),
    ...group.items,
  ]),
);

// The signed-out landing page already has the sign-in form, so its sidebar has
// no Sign in button.
const showSignIn = computed(() => !loggedIn.value && route.path !== "/");

// The sheet editor needs the width, so the sidebar starts collapsed there.
const isEditor = (path: string) => /^\/sheets\/[^/]+\/edit\/?$/.test(path);
// On a detail page (a sheet, a system, …) in a window under 1180px, the sidebar
// collapses to its rail: the full one would push sheets into their narrow layout,
// and the hamburger below 1024px would bring the wide one back. List pages keep
// the full sidebar. Below 1024px the rail state is kept but unseen (the menu
// always opens expanded), so widening past 1024px doesn't flash the full sidebar.
// A toggle by hand lasts until the rule's answer changes. The cookie holds the
// window's class so the server draws the same sidebar.
const isDetail = (path: string) =>
  /^\/(campaigns|characters|content|groups|sheets|systems|types)\/[^/]/.test(path);
const narrowWindow = useCookie<boolean>("sidebar-narrow", {
  default: () => false,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
});
const wantsRail = computed(
  () => isEditor(route.path) || (narrowWindow.value && isDetail(route.path)),
);
const collapsed = ref(wantsRail.value);
watch(wantsRail, (rail) => (collapsed.value = rail));
onMounted(() => {
  const query = window.matchMedia("(max-width: 1179.98px)");
  narrowWindow.value = query.matches;
  query.addEventListener("change", (event) => (narrowWindow.value = event.matches));
});
</script>

<template>
  <UApp>
    <!-- A fixed 232px sidebar, as in the mockup. Its collapsed state is kept by
         the rule above, not Nuxt UI's own storage. -->
    <UDashboardGroup unit="px" :persistent="false" class="print:block print:h-auto">
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
          root: 'group/sidebar bg-default border-e border-default',
          // A wrapping row: the brand line (with the drawer's close button on
          // phones), then the system picker on a line of its own.
          header: 'h-auto flex-wrap items-center gap-x-1.5 gap-y-[18px] px-3.5 pt-[18px] pb-0',
          body: 'gap-[18px] px-3.5 pt-[18px]',
          // The user menu (or Sign in) above the Credits and Source Code links,
          // which show everywhere, the signed-out landing page included.
          footer: 'mx-3.5 flex-col items-stretch gap-1 border-t border-default px-0 py-2.5',
          // The phone drawer is a modal, whose content divides its children
          // with lines; the desktop sidebar has none under the system picker.
          content: 'divide-y-0',
        }"
      >
        <template #header="{ collapsed: isCollapsed }">
          <!-- Every row keeps its place on the rail, which shows the logo alone. -->
          <div
            class="flex h-[22px] min-w-0 flex-1 items-center"
            :class="isCollapsed ? 'justify-center' : 'justify-start'"
          >
            <NuxtLink
              to="/"
              :aria-label="isCollapsed ? 'Soul Tabletop' : undefined"
              class="-m-1 flex items-center gap-2 rounded-md p-1 font-semibold whitespace-nowrap text-highlighted focus-visible:outline-3 focus-visible:outline-primary/25"
            >
              <UIcon name="i-lucide-dices" class="size-[22px] text-primary" />
              <span v-if="!isCollapsed" class="font-display text-xl leading-none font-bold">
                Soul Tabletop
              </span>
            </NuxtLink>
          </div>
          <!-- The toggle is a handle on the sidebar's edge, beside the brand row,
               in the same place in both states. It shows on hover and focus
               (always on touch screens); phones use the drawer instead. -->
          <UButton
            class="absolute top-[17px] -right-3 z-20 hidden size-6 justify-center rounded-full bg-default p-0 opacity-0 ring-1 ring-default transition-opacity group-hover/sidebar:opacity-100 focus-visible:opacity-100 lg:inline-flex [@media(hover:none)]:opacity-100"
            color="neutral"
            variant="ghost"
            size="xs"
            :icon="isCollapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-left'"
            :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            :aria-expanded="!isCollapsed"
            @click="collapsed = !collapsed"
          />
          <!-- In the header, not the scrolling body, which would clip it: on
               desktop it pokes past the sidebar's edge into the page, like a
               bookmark (the mockup). The drawer on phones keeps it inside. On
               the rail it is a button with the system's initials. -->
          <SystemSelector
            :compact="isCollapsed"
            class="relative z-10 shrink-0 basis-full"
            :class="isCollapsed ? undefined : 'lg:basis-[calc(100%+1.375rem)]'"
          />
        </template>

        <template #default="{ collapsed: isCollapsed }">
          <!-- The rail hides the group labels (an empty item stays, before the row
               gap); its lists keep the 20.5px label height as padding. Signed
               in, the first list is Dashboard, which has no label. -->
          <UNavigationMenu
            :items="menuItems"
            orientation="vertical"
            :collapsed="isCollapsed"
            :ui="isCollapsed ? { list: loggedIn ? 'not-first:pt-[20.5px]' : 'pt-[20.5px]' } : undefined"
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
            class="h-9 justify-center"
            icon="i-lucide-log-in"
            :aria-label="isCollapsed ? 'Sign in' : undefined"
            :label="isCollapsed ? undefined : 'Sign in'"
          />
          <UserMenu v-else-if="loggedIn" :collapsed="isCollapsed" />
          <UButton
            to="/credits"
            color="neutral"
            variant="link"
            size="xs"
            :icon="isCollapsed ? 'i-lucide-info' : undefined"
            :aria-label="isCollapsed ? 'Credits' : undefined"
            :label="isCollapsed ? undefined : 'Credits'"
            class="text-muted"
            :class="isCollapsed ? 'self-center' : 'self-start'"
          />
          <UButton
            to="https://github.com/lucyawrey/soultabletop"
            target="_blank"
            color="neutral"
            variant="link"
            size="xs"
            :icon="isCollapsed ? 'i-lucide-code-xml' : undefined"
            :aria-label="isCollapsed ? 'Source Code' : undefined"
            :label="isCollapsed ? undefined : 'Source Code'"
            class="text-muted"
            :class="isCollapsed ? 'self-center' : 'self-start'"
          />
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
