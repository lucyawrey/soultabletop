<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from "@nuxt/ui";
import { authClient } from "~/utils/auth-client";

type AuthMode = "login" | "register";
type AuthFormData = { name?: string; email: string; password: string };

const mode = ref<AuthMode>("login");
const busy = ref(false);
const errorMessage = ref("");

const sessionState = await authClient.useSession(useFetch);

const isRegistering = computed(() => mode.value === "register");

const fields = computed<AuthFormField[]>(() => [
  ...(isRegistering.value
    ? [
        {
          name: "name",
          type: "text",
          label: "Name",
          placeholder: "Your name",
          required: true,
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
    placeholder: "At least 8 characters",
    required: true,
  },
]);

function setMode(nextMode: AuthMode) {
  mode.value = nextMode;
  errorMessage.value = "";
}

async function onSubmit(event: FormSubmitEvent<AuthFormData>) {
  busy.value = true;
  errorMessage.value = "";

  try {
    const result = isRegistering.value
      ? await authClient.signUp.email({
          name: event.data.name?.trim() ?? "",
          email: event.data.email.trim(),
          password: event.data.password,
        })
      : await authClient.signIn.email({
          email: event.data.email.trim(),
          password: event.data.password,
        });

    if (result.error) {
      errorMessage.value = result.error.message ?? "Authentication failed.";
      return;
    }

    await refreshNuxtData();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Authentication failed.";
  } finally {
    busy.value = false;
  }
}

async function signOut() {
  busy.value = true;
  errorMessage.value = "";

  try {
    const result = await authClient.signOut();
    if (result.error) {
      errorMessage.value = result.error.message ?? "Could not sign out.";
      return;
    }

    await refreshNuxtData();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Could not sign out.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
    <UPageCard v-if="sessionState.data.value?.user" class="w-full max-w-sm">
      <template #header>
        <div class="text-center">
          <UIcon name="i-lucide-check" class="mx-auto size-8 text-primary" />
          <h1 class="mt-2 text-xl font-semibold text-highlighted">
            Welcome, {{ sessionState.data.value.user.name }}
          </h1>
        </div>
      </template>

      <UButton
        block
        color="neutral"
        variant="outline"
        :loading="busy"
        @click="signOut"
      >
        Sign out
      </UButton>
    </UPageCard>

    <UPageCard v-else class="w-full max-w-sm">
      <UAuthForm
        :fields="fields"
        :title="isRegistering ? 'Create an account' : 'Sign in'"
        :submit="{ label: isRegistering ? 'Create account' : 'Sign in' }"
        :loading="busy"
        @submit="onSubmit"
      >
        <template #description>
          <p class="text-sm text-muted">
            {{
              isRegistering
                ? "Placeholder for registration copy."
                : "Placeholder for sign-in copy."
            }}
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
          <UAlert color="error" variant="subtle" :description="errorMessage" />
        </template>

        <template #footer>
          <p class="text-center text-sm text-muted">
            Optional supporting text placeholder.
          </p>
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
