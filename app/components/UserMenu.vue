<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import { authClient } from "~/utils/auth-client";

// `collapsed`: the sidebar is an icon rail, so show only the avatar.
defineProps<{ collapsed?: boolean }>();

// The signed-in user's icon and name in the sidebar footer, opening a menu with who is signed
// in, Profile, and Sign out. The sidebar shows it only when logged in.
const session = await useAuthSession();
const user = computed(() => session.data.value?.user);
const { data: profile } = await useProfile(() => user.value?.id);

const displayName = computed(() => user.value?.name ?? "");
// Names aren't unique, so the username is shown with it, unless the name is
// the username itself.
const showUsername = computed(
  () =>
    !!profile.value?.username &&
    profile.value.username.toLowerCase() !== displayName.value.toLowerCase(),
);
const username = computed(() => profile.value?.username ?? "");

// Shown when there is no icon or it fails to load (UAvatar falls back on its
// own): the display name's initials, else the username's first letter.
const initials = computed(() => {
  const fromName = displayName.value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2);
  return (fromName || profile.value?.username.charAt(0) || "").toUpperCase();
});

// UAvatar falls back when its image fires `error`, but on a server-rendered
// page the image can fail before hydration adds that listener, so the sidebar
// avatar also checks on mount.
const iconUrl = computed(() => profile.value?.iconImageUrl ?? undefined);
const iconFailed = ref(false);
watch(iconUrl, () => (iconFailed.value = false));
const triggerAvatar = useTemplateRef<{ $el: HTMLElement }>("triggerAvatar");
onMounted(() => {
  const img = triggerAvatar.value?.$el.querySelector("img");
  if (img?.complete && img.naturalWidth === 0) iconFailed.value = true;
});

const avatar = computed(() => ({
  src: iconFailed.value ? undefined : iconUrl.value,
  alt: displayName.value,
  text: initials.value || undefined,
  // UAvatar prefers an icon over text, so only when there are no initials.
  icon: initials.value ? undefined : "i-lucide-user",
}));

// A gilt disc with the initials, like the mockup.
const avatarUi = { root: "bg-secondary", fallback: "font-bold text-inverted" };

const toast = useToast();
const router = useRouter();
const signOutBusy = ref(false);
async function signOut() {
  if (signOutBusy.value) return;
  signOutBusy.value = true;
  try {
    // Leave the page first: if it has unsaved changes and the user cancels
    // leaving, they stay signed in and can still save.
    await navigateTo("/");
    // The router's own current route: `useRoute()` here still has the old
    // page until the new one finishes loading.
    if (router.currentRoute.value.path !== "/") return;
    const result = await authClient.signOut();
    if (result.error) throw new Error(result.error.message);
    // Mark the session ended now: its own refetch is still in flight, and the
    // refresh below would otherwise reload data (profile, dashboard) as the
    // signed-in user without the cookie.
    session.data.value = null;
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

// "Working as": create dialogs' Owner field starts on this group. Offered only
// when there are groups the user can create resources for.
const { group: workingAs, groups: ownerGroups, setGroup } = useWorkingAs();
const workingAsItems = computed<DropdownMenuItem[]>(() =>
  ownerGroups.value.length
    ? [
        { type: "label", label: "Working as" },
        {
          label: "Yourself",
          type: "checkbox",
          checked: !workingAs.value,
          onUpdateChecked: (checked: boolean) => {
            if (checked) setGroup(null);
          },
        },
        ...ownerGroups.value.map(
          (item): DropdownMenuItem => ({
            label: item.name,
            type: "checkbox",
            checked: workingAs.value?.id === item.id,
            onUpdateChecked: (checked: boolean) =>
              setGroup(checked ? item.id : null),
          }),
        ),
      ]
    : [],
);

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: "label", slot: "account" as const }],
  ...(workingAsItems.value.length ? [workingAsItems.value] : []),
  [
    { label: "Profile", icon: "i-lucide-user", to: "/profile" },
  ],
  [
    {
      label: "Sign out",
      icon: "i-lucide-log-out",
      disabled: signOutBusy.value,
      onSelect: signOut,
    },
  ],
]);
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'start', side: 'top' }"
    :ui="{ content: 'w-72' }"
  >
    <!-- The avatar in the default slot rather than UButton's `avatar` prop,
         which sizes it to the button's small leading-icon size. -->
    <UButton
      color="neutral"
      variant="ghost"
      :block="!collapsed"
      class="gap-2 p-1.5"
      :class="collapsed ? 'justify-center' : 'justify-start'"
      :aria-label="workingAs ? `User menu, working as ${workingAs.name}` : 'User menu'"
    >
      <UIcon
        v-if="signOutBusy"
        name="i-lucide-loader-circle"
        class="size-8 animate-spin p-1.5"
      />
      <!-- The dot marks "working as" a group on the collapsed rail. -->
      <UChip
        v-else
        :show="collapsed && !!workingAs"
        color="primary"
        position="bottom-right"
        inset
      >
        <UAvatar
          ref="triggerAvatar"
          v-bind="avatar"
          size="md"
          :ui="avatarUi"
        />
      </UChip>
      <span v-if="!collapsed" class="min-w-0 flex-1 text-start">
        <span class="block truncate text-sm font-semibold text-highlighted">
          {{ displayName }}
        </span>
        <span
          v-if="workingAs"
          class="flex min-w-0 items-center gap-1 text-xs font-medium text-primary"
        >
          <UIcon name="i-lucide-users" class="size-3.5 shrink-0" />
          <span class="truncate">as {{ workingAs.name }}</span>
        </span>
        <span v-else-if="showUsername" class="block truncate text-xs font-normal text-muted">
          @{{ username }}
        </span>
      </span>
    </UButton>

    <template #account>
      <div class="flex min-w-0 items-center gap-3 py-1">
        <!-- alt="": the name is right beside it. -->
        <UAvatar v-bind="avatar" alt="" size="lg" />
        <div class="min-w-0 text-sm font-normal">
          <p class="truncate font-semibold text-highlighted" :title="displayName">
            {{ displayName }}
          </p>
          <p
            v-if="showUsername"
            class="truncate text-muted"
            :title="`@${username}`"
          >
            @{{ username }}
          </p>
          <p class="truncate text-muted" :title="user?.email">
            {{ user?.email }}
          </p>
        </div>
      </div>
    </template>
  </UDropdownMenu>
</template>
