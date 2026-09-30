<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import { authClient } from "~/utils/auth-client";

// The signed-in user's icon in the header, opening a menu with who is signed
// in, Profile, and Sign out. The header shows it only when logged in.
const session = await useAuthSession();
const user = computed(() => session.data.value?.user);
const { data: profile } = await useProfile(() => !!user.value);

const displayName = computed(() => user.value?.name ?? "");

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

const avatar = computed(() => ({
  src: profile.value?.iconImageUrl ?? undefined,
  alt: displayName.value,
  text: initials.value || undefined,
  // UAvatar prefers an icon over text, so only when there are no initials.
  icon: initials.value ? undefined : "i-lucide-user",
}));

const toast = useToast();
const router = useRouter();
const signOutBusy = ref(false);
async function signOut() {
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

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: "label", slot: "account" as const }],
  [{ label: "Profile", icon: "i-lucide-user", to: "/profile" }],
  [{ label: "Sign out", icon: "i-lucide-log-out", onSelect: signOut }],
]);
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'end' }"
    :ui="{ content: 'w-72' }"
  >
    <!-- The avatar in the default slot rather than UButton's `avatar` prop,
         which sizes it to the button's small leading-icon size. -->
    <UButton
      color="neutral"
      variant="ghost"
      class="rounded-full p-0.5"
      aria-label="User menu"
    >
      <UIcon
        v-if="signOutBusy"
        name="i-lucide-loader-circle"
        class="size-8 animate-spin p-1.5"
      />
      <UAvatar v-else v-bind="avatar" size="md" />
    </UButton>

    <template #account>
      <div class="flex min-w-0 items-center gap-3 py-1">
        <UAvatar v-bind="avatar" size="lg" />
        <div class="min-w-0 text-sm font-normal">
          <p class="truncate font-semibold text-highlighted">
            {{ displayName }}
          </p>
          <p v-if="profile?.username" class="truncate text-muted">
            @{{ profile.username }}
          </p>
          <p class="truncate text-muted" :title="user?.email">
            {{ user?.email }}
          </p>
        </div>
      </div>
    </template>
  </UDropdownMenu>
</template>
