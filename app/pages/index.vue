<script setup lang="ts">
/* eslint better-tailwindcss/no-unknown-classes: off */
import { authClient } from "~/utils/auth-client";

type AuthMode = "login" | "register";

const mode = ref<AuthMode>("login");
const name = ref("");
const email = ref("");
const password = ref("");
const busy = ref(false);
const errorMessage = ref("");

const sessionState = await authClient.useSession(useFetch);

const isRegistering = computed(() => mode.value === "register");

function setMode(nextMode: AuthMode) {
  mode.value = nextMode;
  errorMessage.value = "";
}

async function submit() {
  busy.value = true;
  errorMessage.value = "";

  try {
    const result = isRegistering.value
      ? await authClient.signUp.email({
          name: name.value.trim(),
          email: email.value.trim(),
          password: password.value,
        })
      : await authClient.signIn.email({
          email: email.value.trim(),
          password: password.value,
        });

    if (result.error) {
      errorMessage.value = result.error.message ?? "Authentication failed.";
      return;
    }

    password.value = "";
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
  <main class="auth-page">
    <div class="auth-layout">
      <section class="intro" aria-labelledby="welcome-title">
        <div class="eyebrow">
          <span class="eyebrow-mark" aria-hidden="true"></span>
          BRAND OR SECTION LABEL
        </div>
        <h1 id="welcome-title">Page heading placeholder</h1>
        <p class="intro-copy">
          Placeholder for introductory copy. Replace this text with your own
          page content.
        </p>
      </section>

      <section class="auth-panel" aria-labelledby="auth-title">
        <template v-if="sessionState.data.value?.user">
          <div class="signed-in-mark" aria-hidden="true">
            <UIcon name="i-lucide-check" class="size-6" />
          </div>
          <p class="panel-kicker">SIGNED-IN STATE</p>
          <h2 id="auth-title">
            Welcome, {{ sessionState.data.value.user.name }}
          </h2>
          <p class="panel-copy">Placeholder for signed-in account content.</p>
          <UButton
            block
            color="neutral"
            variant="outline"
            :loading="busy"
            @click="signOut"
          >
            Sign out
          </UButton>
        </template>

        <template v-else>
          <p class="panel-kicker">ACCOUNT ACCESS</p>
          <h2 id="auth-title">
            {{ isRegistering ? "Create an account" : "Sign in" }}
          </h2>
          <p class="panel-copy">
            {{
              isRegistering
                ? "Placeholder for registration copy."
                : "Placeholder for sign-in copy."
            }}
          </p>

          <div class="mode-switch" role="tablist" aria-label="Account access">
            <button
              id="login-tab"
              type="button"
              role="tab"
              :aria-selected="!isRegistering"
              aria-controls="auth-form"
              :class="{ selected: !isRegistering }"
              @click="setMode('login')"
            >
              Sign in
            </button>
            <button
              id="register-tab"
              type="button"
              role="tab"
              :aria-selected="isRegistering"
              aria-controls="auth-form"
              :class="{ selected: isRegistering }"
              @click="setMode('register')"
            >
              Create account
            </button>
          </div>

          <form id="auth-form" class="auth-form" @submit.prevent="submit">
            <UFormField v-if="isRegistering" label="Name" name="name" required>
              <UInput
                v-model="name"
                autocomplete="name"
                placeholder="Your name"
                size="lg"
                class="w-full"
                required
              />
            </UFormField>
            <UFormField label="Email" name="email" required>
              <UInput
                v-model="email"
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
                size="lg"
                class="w-full"
                required
              />
            </UFormField>
            <UFormField label="Password" name="password" required>
              <UInput
                v-model="password"
                type="password"
                :autocomplete="
                  isRegistering ? 'new-password' : 'current-password'
                "
                placeholder="At least 8 characters"
                size="lg"
                class="w-full"
                minlength="8"
                required
              />
            </UFormField>

            <p v-if="errorMessage" class="form-error" role="alert">
              {{ errorMessage }}
            </p>

            <UButton
              type="submit"
              block
              size="lg"
              color="primary"
              trailing-icon="i-lucide-arrow-right"
              :loading="busy"
              :disabled="busy"
            >
              {{ isRegistering ? "Create account" : "Sign in" }}
            </UButton>
          </form>

          <p class="panel-footnote">Optional supporting text placeholder.</p>
        </template>
      </section>
    </div>
  </main>
</template>

<style scoped>
.auth-page {
  --auth-ink: #18372d;
  --auth-muted: #65766e;
  --auth-line: #dce5df;
  --auth-paper: #fbfcf9;
  --auth-accent: #c45435;
  min-height: calc(100vh - 8rem);
  color: var(--auth-ink);
  background-color: #f1f5f0;
  background-image:
    linear-gradient(rgb(24 55 45 / 4%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(24 55 45 / 4%) 1px, transparent 1px);
  background-position: center center;
  background-size: 32px 32px;
}

.auth-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 430px);
  align-items: center;
  gap: clamp(3rem, 8vw, 8rem);
  width: min(1100px, 100%);
  min-height: calc(100vh - 8rem);
  margin: 0 auto;
  padding: 5rem 2rem;
}

.intro {
  max-width: 560px;
  animation: enter 550ms ease-out both;
}

.eyebrow,
.panel-kicker {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  color: var(--auth-accent);
  font-size: 0.72rem;
  font-weight: 750;
}

.eyebrow {
  letter-spacing: 0.08em;
}

.eyebrow-mark {
  width: 0.6rem;
  height: 0.6rem;
  border: 2px solid currentColor;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgb(196 84 53 / 10%);
}

.intro h1 {
  max-width: 10ch;
  margin: 1.4rem 0 1.1rem;
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(2.7rem, 5vw, 4.8rem);
  font-weight: 500;
  line-height: 1.02;
}

.intro-copy,
.panel-copy {
  color: var(--auth-muted);
  line-height: 1.7;
}

.intro-copy {
  max-width: 35rem;
  margin: 0;
  font-size: 1.05rem;
}

.auth-panel {
  padding: clamp(1.5rem, 4vw, 2.4rem);
  border: 1px solid var(--auth-line);
  border-radius: 8px;
  background: var(--auth-paper);
  box-shadow: 0 20px 60px rgb(24 55 45 / 8%);
  animation: enter 650ms 100ms ease-out both;
}

.auth-panel h2 {
  margin: 0.65rem 0 0.35rem;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.75rem;
  font-weight: 500;
  line-height: 1.2;
}

.panel-copy {
  margin: 0;
  font-size: 0.9rem;
}

.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem;
  margin: 1.5rem 0;
  padding: 0.25rem;
  border: 1px solid var(--auth-line);
  border-radius: 6px;
  background: #f1f5f0;
}

.mode-switch button {
  min-height: 2.6rem;
  padding: 0.45rem 0.6rem;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--auth-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 650;
}

.mode-switch button.selected {
  background: var(--auth-paper);
  color: var(--auth-ink);
  box-shadow: 0 1px 3px rgb(24 55 45 / 12%);
}

.mode-switch button:focus-visible {
  outline: 2px solid var(--auth-accent);
  outline-offset: 2px;
}

.auth-form {
  display: grid;
  gap: 1rem;
}

.form-error {
  margin: 0;
  color: #a12f26;
  font-size: 0.88rem;
}

.panel-footnote {
  margin: 1.25rem 0 0;
  color: var(--auth-muted);
  font-size: 0.75rem;
  line-height: 1.6;
  text-align: center;
}

.signed-in-mark {
  display: grid;
  width: 2.8rem;
  aspect-ratio: 1;
  margin-bottom: 1.25rem;
  place-items: center;
  border-radius: 50%;
  background: #e5f1e9;
  color: #2f6948;
}

.auth-panel > :deep(button) {
  margin-top: 1.5rem;
}

@keyframes enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 760px) {
  .auth-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 2rem;
    width: min(520px, 100%);
    padding: 3.5rem 1.25rem;
  }

  .intro h1 {
    max-width: 12ch;
    font-size: 2.8rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
