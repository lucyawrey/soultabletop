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
}

interface Dashboard {
  campaigns: RecentItem[];
  characters: RecentItem[];
  content: RecentItem[];
}

const mode = ref<AuthMode>("login");
const registerForm = reactive({ name: "", username: "" });
// The username as typed is also the default display name, so capitalization is
// accepted here (the server stores the username lowercase).
const usernameError = computed(() => {
  const typed = registerForm.username.trim();
  if (typed.length > MAX_USERNAME_LENGTH)
    return `Use at most ${MAX_USERNAME_LENGTH} characters.`;
  return getReadableIdError(typed.toLowerCase());
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

const recentSections = computed(() => {
  // "idle" counts too: the fetch only starts once signed in, so on the server
  // (and before the client's first watch run) nothing has been requested yet,
  // and showing the empty state there would flash "No ... yet." before loading.
  const loading = isLoading(dashboardStatus.value);
  return [
    {
      title: "Campaigns",
      icon: "i-lucide-swords",
      path: "/campaigns",
      empty: "No campaigns yet.",
      items: dashboard.value.campaigns,
      loading,
    },
    {
      title: "Characters",
      icon: "i-lucide-users",
      path: "/characters",
      empty: "No characters yet.",
      items: dashboard.value.characters,
      loading,
    },
    {
      title: "Content",
      icon: "i-lucide-file-text",
      path: "/content",
      empty: "No content yet.",
      items: dashboard.value.content,
      loading,
    },
  ];
});

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
  <div class="mx-auto w-full max-w-(--ui-container) p-4">
    <div
      v-if="!isLoggedIn"
      class="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-12 lg:flex-row lg:gap-24"
    >
      <div class="max-w-md space-y-4 text-center lg:text-left">
        <UBadge color="primary" variant="subtle" size="lg">
          {{ copy.home.badge }}
        </UBadge>
        <h1 class="text-4xl font-bold text-highlighted sm:text-5xl">
          {{ copy.home.heading }}
        </h1>
        <p class="text-lg text-muted">
          {{ copy.home.intro }}
        </p>
      </div>

      <UPageCard class="w-full max-w-sm">
        <UAuthForm
          ref="authForm"
          :key="mode"
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

    <div v-else class="space-y-6 py-8">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-highlighted">
            {{ fillCopy(copy.dashboard.heading, { name: sessionState.data.value?.user.name ?? "" }) }}
          </h1>
          <p class="text-sm text-muted">{{ copy.dashboard.subheading }}</p>
        </div>
      </div>

      <UAlert
        v-if="errorMessage"
        color="error"
        variant="subtle"
        :description="errorMessage"
      />

      <div class="grid gap-6 lg:grid-cols-3">
        <UPageCard v-for="section in recentSections" :key="section.title">
          <template #header>
            <div class="flex items-center justify-between gap-4">
              <h2
                class="flex items-center gap-2 text-lg font-semibold text-highlighted"
              >
                <UIcon :name="section.icon" class="size-5 text-primary" />
                Recent {{ section.title }}
              </h2>
              <UButton
                :to="section.path"
                color="neutral"
                variant="link"
                size="sm"
                trailing-icon="i-lucide-arrow-right"
              >
                View all
              </UButton>
            </div>
          </template>

          <ul v-if="section.items.length" class="divide-y divide-default">
            <li
              v-for="item in section.items"
              :key="item.id"
              class="flex items-center justify-between gap-2 py-2"
            >
              <NuxtLink
                :to="`${section.path}/${item.id}`"
                class="truncate font-medium text-highlighted hover:underline"
              >
                {{ item.name }}
              </NuxtLink>
              <span class="shrink-0 text-sm text-muted">
                {{ formatUpdated(item.updatedAt) }}
              </span>
            </li>
          </ul>
          <!-- One row, as tall as a real item: the shortest loaded card, so the
               page only grows when the entries arrive. -->
          <div v-else-if="section.loading" role="status">
            <span class="sr-only">Loading</span>
            <div
              aria-hidden="true"
              class="flex h-10 items-center justify-between gap-2"
            >
              <LookupSkeleton size-class="h-4 w-40 max-w-2/3" />
              <LookupSkeleton size-class="h-3.5 w-16" />
            </div>
          </div>
          <p v-else class="py-6 text-center text-sm text-muted">
            {{ section.empty }}
            <NuxtLink
              :to="{ path: section.path, query: { new: '1' } }"
              class="text-primary hover:underline"
            >
              Create one.
            </NuxtLink>
          </p>
        </UPageCard>
      </div>
    </div>
  </div>
</template>
