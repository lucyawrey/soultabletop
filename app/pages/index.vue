<script setup lang="ts">
import type { AuthFormField, FormError, FormSubmitEvent } from "@nuxt/ui";
import {
  MAX_USERNAME_LENGTH,
  getDisplayNameError,
} from "#shared/display-name";
import { safeRedirectPath } from "#shared/sign-in-redirect";
import { authClient } from "~/utils/auth-client";
import { getReadableIdError } from "~/utils/readable-id";

type AuthMode = "login" | "register";
type AuthFormData = {
  name?: string;
  email: string;
  password: string;
  confirmPassword?: string;
};

interface RecentItem {
  id: string;
  name: string;
  updatedAt: string;
  systemId: string | null;
}

interface RecentCampaign extends RecentItem {
  // The user's role, or null for a campaign they own without being a member.
  role: "gm" | "player" | null;
}

interface RecentContent extends RecentItem {
  contentTypeId: string;
}

interface Dashboard {
  campaigns: RecentCampaign[];
  characters: RecentContent[];
  content: RecentContent[];
}

const mode = ref<AuthMode>("login");
const registerForm = reactive({ name: "", username: "" });
// The username as typed is also the default display name, so capitalization is
// accepted here (the server stores the username lowercase).
const usernameFormatError = computed(() => {
  const typed = registerForm.username.trim();
  if (typed.length > MAX_USERNAME_LENGTH)
    return `Use at most ${MAX_USERNAME_LENGTH} characters.`;
  return getReadableIdError(typed.toLowerCase());
});
// Live availability, from the same public check the form runs on submit.
const usernameAvailability = useReadableIdAvailability(() => {
  const typed = registerForm.username.trim().toLowerCase();
  return !typed || usernameFormatError.value
    ? null
    : {
        endpoint: "/api/profile/username-availability",
        query: { username: typed },
      };
});
const usernameError = computed(() => {
  if (usernameFormatError.value) return usernameFormatError.value;
  if (usernameAvailability.value === "taken")
    return "That username is already in use.";
  return undefined;
});
const usernameHint = computed(() => {
  if (usernameAvailability.value === "checking") return "Checking availability…";
  if (usernameAvailability.value === "available") return "That username is available.";
  if (usernameAvailability.value === "failed") return "Could not check availability.";
  return undefined;
});
const displayNamePlaceholder = computed(
  () => registerForm.username.trim() || "Your display name",
);
const authBusy = ref(false);
const errorMessage = ref("");

const sessionState = await useAuthSession();
const isLoggedIn = computed(() => !!sessionState.data.value?.user);

// Pages that need an account send visitors here with `?redirect=<path>`; they
// go back there once signed in.
const route = useRoute();
const redirectPath = computed(() => safeRedirectPath(route.query.redirect));
if (isLoggedIn.value && redirectPath.value) {
  await navigateTo(redirectPath.value, { replace: true });
}

const isRegistering = computed(() => mode.value === "register");

const fields = computed<AuthFormField[]>(() => [
  ...(isRegistering.value
    ? [
        {
          name: "username",
          type: "text",
          label: "Username",
          description:
            "Letters, numbers, and hyphens. Must be unique; stored in lowercase.",
          placeholder: "your-name",
          required: true,
          error: usernameError.value,
        } satisfies AuthFormField,
        {
          name: "name",
          type: "text",
          label: "Display Name",
          description: "Optional. Defaults to your username.",
          placeholder: displayNamePlaceholder.value,
          error: getDisplayNameError(registerForm.name),
        } satisfies AuthFormField,
      ]
    : []),
  {
    name: "email",
    type: "email",
    label: "Email",
    placeholder: "you@example.com",
    required: true,
  },
  {
    name: "password",
    type: "password",
    label: "Password",
    ...(isRegistering.value ? { description: "At least 8 characters." } : {}),
    placeholder: "At least 8 characters",
    required: true,
  },
  ...(isRegistering.value
    ? [
        {
          name: "confirmPassword",
          type: "password",
          label: "Confirm Password",
          placeholder: "Enter your password again",
          required: true,
        } satisfies AuthFormField,
      ]
    : []),
]);

// UAuthForm keeps email and password in its own state; name and username are
// in `registerForm` because their inputs are custom slots.
const authForm = useTemplateRef("authForm");
const canSubmit = computed(() => {
  const state = authForm.value?.state as Partial<AuthFormData> | undefined;
  if (!state?.email?.trim() || !state.password) return false;
  if (!isRegistering.value) return true;
  return (
    !!registerForm.username.trim() &&
    !usernameError.value &&
    !getDisplayNameError(registerForm.name) &&
    state.password === state.confirmPassword
  );
});

function validateAuthForm(state: Partial<AuthFormData>): FormError[] {
  if (isRegistering.value && state.password !== state.confirmPassword) {
    return [{ name: "confirmPassword", message: "Passwords don't match." }];
  }
  return [];
}

// UForm only re-validates the field being edited, so editing Password would
// leave a stale "Passwords don't match." on Confirm Password.
watch(
  () => authForm.value?.state.password,
  () => {
    if (!isRegistering.value || !authForm.value?.state.confirmPassword) return;
    authForm.value.formRef?.validate({
      name: "confirmPassword",
      silent: true,
    });
  },
);

function setMode(nextMode: AuthMode) {
  if (authBusy.value) return;
  mode.value = nextMode;
  if (nextMode === "register") {
    registerForm.name = "";
    registerForm.username = "";
  }
  errorMessage.value = "";
}

async function onSubmit(event: FormSubmitEvent<AuthFormData>) {
  const registering = isRegistering.value;
  authBusy.value = true;
  errorMessage.value = "";

  try {
    const typedUsername = registerForm.username.trim();
    const username = typedUsername.toLowerCase();
    if (registering) {
      if (!username) {
        errorMessage.value = "Username is required.";
        return;
      }
      if (usernameError.value) {
        errorMessage.value = usernameError.value;
        return;
      }
      if (getReadableIdError(username)) {
        errorMessage.value =
          "Username must use letters, numbers, and hyphens only.";
        return;
      }

      const availability = await $fetch<{ available: boolean }>(
        "/api/profile/username-availability",
        { query: { username } },
      );
      if (!availability.available) {
        errorMessage.value = "That username is already in use.";
        return;
      }
    }

    if (registering) {
      await $fetch("/api/register", {
        method: "POST",
        body: {
          // Empty: the server uses the username as typed.
          ...(registerForm.name.trim() ? { name: registerForm.name.trim() } : {}),
          email: event.data.email.trim(),
          password: event.data.password,
          username: typedUsername,
        },
      });
      const session = await authClient.getSession();
      if (session.error || !session.data) {
        throw session.error ?? new Error("Could not load the new session.");
      }
      authClient.hydrateSession(session.data);
    } else {
      const result = await authClient.signIn.email({
        email: event.data.email.trim(),
        password: event.data.password,
      });

      if (result.error) {
        errorMessage.value = result.error.message ?? "Authentication failed.";
        return;
      }

      await $fetch("/api/profile");
    }

    await refreshNuxtData();
    if (redirectPath.value) await navigateTo(redirectPath.value, { replace: true });
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Authentication or profile setup failed.";
  } finally {
    authBusy.value = false;
  }
}

// Welcome dashboard: recently updated Campaigns the user or their Groups own or
// play in, and Characters/Content they or their Groups own (never merely
// public or shared items). Fetched only once signed in.
const {
  data: dashboard,
  status: dashboardStatus,
  refresh: refreshDashboard,
} = useLazyFetch<Dashboard>("/api/dashboard", {
  default: () => ({ campaigns: [], characters: [], content: [] }),
  // Already signed in: fetch during the server render, so it and the client's
  // first render agree. Otherwise the watch below fetches after sign-in.
  immediate: isLoggedIn.value,
});

watch([isLoggedIn, authBusy], ([loggedIn, submittingAuth]) => {
  if (loggedIn && !submittingAuth) refreshDashboard();
});

// The dashboard names systems and content types from lists the viewer can
// read, so an item never shows the name of something they can't see.
const { findSystem } = useSystems();
const { data: contentTypes } = useLazyFetch<{ id: string; name: string }[]>(
  "/api/content-type",
  { key: "dashboard-content-types", default: () => [], immediate: isLoggedIn.value },
);
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) refreshNuxtData("dashboard-content-types");
});
const ROLE_LABELS = { gm: "GM", player: "Player" } as const;

function itemDetail(item: RecentItem & Partial<RecentCampaign & RecentContent>) {
  return [
    item.role ? ROLE_LABELS[item.role] : undefined,
    item.contentTypeId
      ? contentTypes.value.find((type) => type.id === item.contentTypeId)?.name
      : undefined,
    findSystem(item.systemId)?.name,
  ]
    .filter(Boolean)
    .join(" · ");
}

// "idle" counts as loading too: the fetch only starts once signed in, so on the
// server (and before the client's first watch run) nothing has been requested
// yet, and showing the empty state there would flash before loading.
const dashboardLoading = computed(() => isLoading(dashboardStatus.value));

const recentSections = computed(() =>
  [
    { title: "Campaigns", kind: "Campaign", path: "/campaigns", items: dashboard.value.campaigns },
    { title: "Characters", kind: "Character", path: "/characters", items: dashboard.value.characters },
    { title: "Content", kind: "Content", path: "/content", items: dashboard.value.content },
  ].map((section) => ({
    ...section,
    cards: section.items.map((item) => ({
      id: item.id,
      name: item.name,
      updatedAt: item.updatedAt,
      to: `${section.path}/${item.id}`,
      detail: itemDetail(item),
    })),
  })),
);

// The most recently edited item of all, for the Continue card.
const continueItem = computed(() => {
  const all = recentSections.value.flatMap((section) =>
    section.cards.map((card) => ({ ...card, kind: section.kind })),
  );
  return all.reduce<(typeof all)[number] | undefined>(
    (latest, card) =>
      !latest || Date.parse(card.updatedAt) > Date.parse(latest.updatedAt) ? card : latest,
    undefined,
  );
});

// Someone with nothing yet gets the first-visit heading and start cards.
const isNewUser = computed(() => !dashboardLoading.value && !continueItem.value);

const startCards = [
  { title: "Make a character", icon: "i-lucide-user", label: "New Character", to: "/characters?new=1", primary: true },
  { title: "Start a campaign", icon: "i-lucide-flag", label: "New Campaign", to: "/campaigns?new=1" },
  { title: "Find a system", icon: "i-lucide-globe", label: "Browse Systems", to: "/systems?tab=find" },
  { title: "Build your own", icon: "i-lucide-shapes", label: "New System", to: "/systems?new=1" },
];

const relativeTime = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});
const timeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

function formatUpdated(updatedAt: string) {
  const seconds = (Date.parse(updatedAt) - Date.now()) / 1000;
  for (const [unit, size] of timeUnits) {
    if (Math.abs(seconds) >= size)
      return relativeTime.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
</script>

<template>
  <PageContainer>
    <div
      v-if="!isLoggedIn"
      class="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-12 lg:flex-row lg:gap-24"
    >
      <div class="max-w-md space-y-4 text-center lg:text-left">
        <UBadge color="primary" variant="subtle" size="lg">
          {{ copy.home.badge }}
        </UBadge>
        <h1 class="text-[44px] leading-none font-bold text-highlighted sm:text-[56px]">
          {{ copy.home.heading }}
        </h1>
        <p class="text-lg text-muted">
          {{ copy.home.intro }}
        </p>
        <UButton
          to="/systems"
          color="primary"
          variant="link"
          trailing-icon="i-lucide-arrow-right"
          class="p-0 font-semibold"
        >
          Browse public systems and sheets
        </UButton>
      </div>

      <UPageCard class="w-full max-w-sm shadow-lg shadow-black/5">
        <UAuthForm
          ref="authForm"
          :key="mode"
          :ui="{ title: 'font-display text-[32px] leading-tight font-bold' }"
          :fields="fields"
          :title="isRegistering ? 'Create an account' : 'Sign in'"
          :submit="{
            label: isRegistering ? 'Create account' : 'Sign in',
            disabled: !canSubmit,
          }"
          :loading="authBusy"
          :validate="validateAuthForm"
          @submit="onSubmit"
        >
          <template #username-field>
            <UInput
              v-model="registerForm.username"
              class="w-full"
              size="md"
              name="username"
              autocomplete="nickname"
              autocapitalize="none"
              placeholder="your-name"
              required
            />
            <p
              v-if="usernameHint"
              class="mt-1 text-sm"
              :class="usernameAvailability === 'available' ? 'text-success' : 'text-muted'"
            >
              {{ usernameHint }}
            </p>
          </template>
          <template #name-field>
            <UInput
              v-model="registerForm.name"
              class="w-full"
              size="md"
              name="name"
              :placeholder="displayNamePlaceholder"
            />
          </template>
          <template #description>
            <p class="text-sm text-muted">
              {{ isRegistering ? copy.home.registerNote : copy.home.signInNote }}
            </p>
            <UTabs
              :items="[
                { label: 'Sign in', value: 'login' },
                { label: 'Create account', value: 'register' },
              ]"
              :model-value="mode"
              size="xs"
              class="mt-4"
              @update:model-value="(value) => setMode(value as AuthMode)"
            />
          </template>

          <template v-if="errorMessage" #validation>
            <UAlert
              color="error"
              variant="subtle"
              :description="errorMessage"
            />
          </template>
        </UAuthForm>
      </UPageCard>
    </div>

    <div v-else class="space-y-5">
      <PageHeader
        :title="
          isNewUser
            ? copy.dashboard.newHeading
            : fillCopy(copy.dashboard.heading, { name: sessionState.data.value?.user.name ?? '' })
        "
        :description="isNewUser ? undefined : copy.dashboard.subheading"
      >
        <UButton to="/characters?new=1" icon="i-lucide-plus">New Character</UButton>
        <UButton to="/campaigns?new=1" icon="i-lucide-plus" color="neutral" variant="outline">
          New Campaign
        </UButton>
      </PageHeader>

      <UAlert
        v-if="errorMessage"
        color="error"
        variant="subtle"
        :description="errorMessage"
      />

      <TableSkeleton v-if="dashboardLoading" :rows="3" />

      <template v-else-if="isNewUser">
        <div class="rounded-lg border-2 border-dashed border-accented px-[18px] py-4">
          <p class="font-semibold text-toned">{{ copy.dashboard.welcome }}</p>
        </div>
        <ul class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <li
            v-for="card in startCards"
            :key="card.title"
            class="space-y-3 rounded-lg border border-default bg-default p-4"
          >
            <h2 class="flex items-center gap-2 font-bold text-highlighted">
              <UIcon :name="card.icon" class="size-[18px] text-secondary" />
              {{ card.title }}
            </h2>
            <UButton
              :to="card.to"
              :color="card.primary ? 'primary' : 'neutral'"
              :variant="card.primary ? 'solid' : 'outline'"
            >
              {{ card.label }}
            </UButton>
          </li>
        </ul>
      </template>

      <template v-else>
        <section
          v-if="continueItem"
          class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-default bg-default px-[22px] py-5"
        >
          <div class="min-w-0">
            <p class="text-xs font-bold tracking-[0.1em] text-muted uppercase">
              Continue · {{ continueItem.kind }}
            </p>
            <h2 class="font-display text-[34px] leading-tight font-bold text-highlighted">
              {{ continueItem.name }}
            </h2>
            <p class="text-sm text-muted">
              <template v-if="continueItem.detail">{{ continueItem.detail }} · </template>
              edited {{ formatUpdated(continueItem.updatedAt) }}
            </p>
          </div>
          <UButton :to="continueItem.to">Open</UButton>
        </section>

        <section v-for="section in recentSections" :key="section.title" class="space-y-2.5">
          <div class="flex items-center justify-between gap-4">
            <h2 class="font-display text-[26px] leading-tight font-bold text-highlighted">
              {{ section.title }}
            </h2>
            <UButton :to="section.path" variant="link" class="p-0">View all</UButton>
          </div>
          <ul
            v-if="section.cards.length"
            class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"
          >
            <li v-for="card in section.cards" :key="card.id">
              <RecentCard :to="card.to" :name="card.name" :detail="card.detail" />
            </li>
          </ul>
          <p v-else class="text-sm text-muted">
            No {{ section.title.toLowerCase() }} yet.
            <NuxtLink
              :to="{ path: section.path, query: { new: '1' } }"
              class="text-primary hover:underline"
            >
              Create one.
            </NuxtLink>
          </p>
        </section>
      </template>
    </div>
  </PageContainer>
</template>
