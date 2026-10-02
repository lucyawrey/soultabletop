<script setup lang="ts">
import { MAX_USERNAME_LENGTH, getDisplayNameError } from "#shared/display-name";
import { extractApiErrorMessage } from "~/utils/api-error";
import { authClient } from "~/utils/auth-client";
import { getReadableIdError } from "~/utils/readable-id";

definePageMeta({ middleware: "auth" });

interface GroupSummary {
  id: string;
  name: string;
  readableId: string;
  kind: "user" | "system";
  // null for a site admin viewing a system group they aren't in.
  role: "admin" | "editor" | "member" | null;
}

const nuxtApp = useNuxtApp();
const session = await useAuthSession();
const user = computed(() => session.data.value?.user);

// Shared with the header's user menu, so saving here updates it too.
const { data: profile, refresh } = await useProfile(() => user.value?.id);
// The header may have loaded it long before: start the form from fresh values
// (on a full page load it was just fetched).
if (import.meta.client && !nuxtApp.isHydrating) await refresh();
const { data: groups, status: groupsStatus } = await useLazyFetch<GroupSummary[]>("/api/group", {
  default: () => [],
});

// A display name that is just the username (the default) shows as empty, so
// the field's placeholder, the username, is visible.
function isDefaultName(name: string) {
  return name.toLowerCase() === (profile.value?.username ?? "").toLowerCase();
}
function formName() {
  const name = user.value?.name ?? "";
  return isDefaultName(name) ? "" : name;
}

const form = reactive({
  name: formName(),
  username: profile.value?.username ?? "",
  iconImageUrl: profile.value?.iconImageUrl ?? "",
});

const username = computed(() => form.username.trim().toLowerCase());
const iconUrl = computed(() => form.iconImageUrl.trim());

const usernameFormatError = computed(() => getReadableIdError(username.value));
const usernameChanged = computed(
  () => username.value !== (profile.value?.username ?? ""),
);

// Live availability check; only for a changed, well-formed username.
const availability = useReadableIdAvailability(() =>
  !username.value ||
  !usernameChanged.value ||
  usernameFormatError.value ||
  username.value.length > MAX_USERNAME_LENGTH
    ? null
    : {
        endpoint: "/api/profile/username-availability",
        query: { username: username.value },
      },
);

const usernameError = computed(() => {
  if (!username.value) return "Username is required.";
  if (usernameFormatError.value) return usernameFormatError.value;
  if (username.value.length > MAX_USERNAME_LENGTH)
    return `Use at most ${MAX_USERNAME_LENGTH} characters.`;
  if (availability.value === "taken") return "That username is already in use.";
  return undefined;
});
const displayName = computed(() => form.name.trim());
// Clearing it resets the display name to the username.
const nameChanged = computed(
  () => displayName.value !== formName(),
);
const nameError = computed(() => getDisplayNameError(form.name));

const iconChanged = computed(
  () => iconUrl.value !== (profile.value?.iconImageUrl ?? ""),
);
// Only checked when edited, so a stored legacy icon doesn't block other changes.
const iconError = computed(() => {
  if (!iconChanged.value || !iconUrl.value) return undefined;
  if (!/^https:\/\/\S+$/.test(iconUrl.value))
    return "Use an https:// image URL.";
  return undefined;
});
// The preview is shown only for a valid URL that loads.
const iconFailed = ref(false);
watch(iconUrl, () => (iconFailed.value = false));

const dirty = computed(
  () => nameChanged.value || usernameChanged.value || iconChanged.value,
);
const canSave = computed(
  () =>
    dirty.value &&
    !usernameError.value &&
    !nameError.value &&
    !iconError.value &&
    availability.value !== "checking",
);

const saving = ref(false);
const saveError = ref("");
const saved = ref(false);

async function save() {
  if (!canSave.value) return;
  saving.value = true;
  saveError.value = "";
  saved.value = false;
  try {
    await $fetch("/api/profile", {
      method: "PATCH",
      body: {
        ...(nameChanged.value ? { name: displayName.value || null } : {}),
        ...(usernameChanged.value ? { username: form.username.trim() } : {}),
        ...(iconChanged.value ? { iconImageUrl: iconUrl.value || null } : {}),
      },
    });
    // The display name is Better Auth's `user.name`, read from the session, so
    // refresh the session too: the header menu shows both. Past the cookie
    // cache, which still has the old name, and that also rewrites the cache.
    const [, fresh] = await Promise.all([
      refresh(),
      authClient.getSession({ query: { disableCookieCache: true } }),
    ]);
    if (fresh.data) {
      authClient.hydrateSession(fresh.data);
      // `useAuthSession` reads through its own fetch, so set its data too.
      session.data.value = fresh.data;
    }
    form.name = formName();
    form.username = profile.value?.username ?? "";
    form.iconImageUrl = profile.value?.iconImageUrl ?? "";
    availability.value = "idle";
    saved.value = true;
  } catch (error) {
    saveError.value = extractApiErrorMessage(error, "Could not save profile.");
  } finally {
    saving.value = false;
  }
}

useUnsavedChangesGuard(dirty);

// Better Auth's defaults, also what registration enforces.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const passwordForm = reactive({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  revokeOtherSessions: true,
});
const passwordError = ref("");
const passwordChanged = ref(false);
const changingPassword = ref(false);

// The success message hides once any password field is edited again.
const passwordDirty = computed(
  () =>
    !!passwordForm.currentPassword ||
    !!passwordForm.newPassword ||
    !!passwordForm.confirmPassword,
);

const newPasswordError = computed(() => {
  const length = passwordForm.newPassword.length;
  if (!length) return undefined;
  if (length < MIN_PASSWORD_LENGTH)
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (length > MAX_PASSWORD_LENGTH)
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  return undefined;
});
const confirmPasswordError = computed(() =>
  passwordForm.confirmPassword &&
  passwordForm.confirmPassword !== passwordForm.newPassword
    ? "Passwords don't match."
    : undefined,
);
const canChangePassword = computed(
  () =>
    !!passwordForm.currentPassword &&
    !!passwordForm.newPassword &&
    !newPasswordError.value &&
    passwordForm.confirmPassword === passwordForm.newPassword,
);

async function changePassword() {
  if (!canChangePassword.value || changingPassword.value) return;
  changingPassword.value = true;
  passwordError.value = "";
  passwordChanged.value = false;
  try {
    const result = await authClient.changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
      revokeOtherSessions: passwordForm.revokeOtherSessions,
    });
    if (result.error) throw result.error;
    passwordForm.currentPassword = "";
    passwordForm.newPassword = "";
    passwordForm.confirmPassword = "";
    passwordChanged.value = true;
  } catch (error) {
    passwordForm.currentPassword = "";
    passwordError.value =
      (error as { code?: unknown } | null)?.code === "INVALID_PASSWORD"
        ? "Current password is incorrect."
        : extractApiErrorMessage(error, "Could not change password.");
  } finally {
    changingPassword.value = false;
  }
}

const groupColumns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "readableId", header: "ID" },
  { accessorKey: "role", header: "Role" },
];
</script>

<template>
  <PageContainer>
    <PageHeader eyebrow="Account" title="Profile" />

    <DetailPanel title="Account">
      <div class="space-y-4 p-[18px]">
      <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
        <dt class="text-muted">Email</dt>
        <dd>{{ user?.email }}</dd>
        <dt class="text-muted">Site Role</dt>
        <dd>{{ profile?.role === "admin" ? "Admin" : "Member" }}</dd>
      </dl>
      </div>
    </DetailPanel>

    <DetailPanel title="Edit Profile">
      <div class="space-y-4 p-[18px]">
      <!-- Deliberately not a <form>: Firefox treats a username-like field in a
           form as a login form and autofills saved credentials, ignoring
           autocomplete="off". -->
      <div class="space-y-4">
        <UAlert
          v-if="saveError"
          color="error"
          variant="subtle"
          :title="saveError"
        />
        <UAlert
          v-else-if="saved && !dirty"
          color="success"
          variant="subtle"
          title="Profile saved."
        />

        <UFormField
          name="name"
          label="Display Name"
          description="Optional. Leave empty to use your username."
          :error="nameError"
        >
          <UInput
            v-model="form.name"
            class="w-full"
            :placeholder="profile?.username"
            autocomplete="off"
            data-1p-ignore
          />
        </UFormField>

        <ReadableIdField
          v-model="form.username"
          name="handle"
          label="Username"
          description="Lowercase letters, numbers, and hyphens."
          :error="usernameError"
          :availability="availability"
          subject="username"
        />

        <UFormField
          name="iconImageUrl"
          label="Icon Image URL"
          description="An https:// link to an image. Leave empty for no icon."
          :error="iconError"
        >
          <UInput
            v-model="form.iconImageUrl"
            type="url"
            class="w-full"
            placeholder="https://example.com/icon.png"
          />
        </UFormField>

        <div v-if="iconUrl && !iconError" class="flex items-center gap-3">
          <UAvatar
            v-if="!iconFailed"
            :src="iconUrl"
            alt="Icon preview"
            size="xl"
            @error="iconFailed = true"
          />
          <p class="text-sm" :class="iconFailed ? 'text-error' : 'text-muted'">
            {{ iconFailed ? "Could not load this image." : "Preview" }}
          </p>
        </div>

        <UButton :loading="saving" :disabled="!canSave" @click="save">
          Save
        </UButton>
      </div>
      </div>
    </DetailPanel>

    <DetailPanel title="Change Password">
      <div class="space-y-4 p-[18px]">
      <!-- Its own <form>, with no username field (see the note above). -->
      <form class="space-y-4" @submit.prevent="changePassword">
        <UAlert
          v-if="passwordError"
          color="error"
          variant="subtle"
          :title="passwordError"
        />
        <UAlert
          v-else-if="passwordChanged && !passwordDirty"
          color="success"
          variant="subtle"
          title="Password changed."
        />

        <UFormField name="currentPassword" label="Current Password">
          <UInput
            v-model="passwordForm.currentPassword"
            type="password"
            autocomplete="current-password"
            class="w-full"
          />
        </UFormField>

        <UFormField
          name="newPassword"
          label="New Password"
          :description="`At least ${MIN_PASSWORD_LENGTH} characters.`"
          :error="newPasswordError"
        >
          <UInput
            v-model="passwordForm.newPassword"
            type="password"
            autocomplete="new-password"
            class="w-full"
          />
        </UFormField>

        <UFormField
          name="confirmPassword"
          label="Confirm New Password"
          :error="confirmPasswordError"
        >
          <UInput
            v-model="passwordForm.confirmPassword"
            type="password"
            autocomplete="new-password"
            class="w-full"
          />
        </UFormField>

        <UCheckbox
          v-model="passwordForm.revokeOtherSessions"
          label="Sign out of other sessions"
        />

        <UButton
          type="submit"
          :loading="changingPassword"
          :disabled="!canChangePassword"
        >
          Change Password
        </UButton>
      </form>
      </div>
    </DetailPanel>

    <ApiKeysCard />

    <DetailPanel title="Groups">
      <UTable
        :data="groups"
        :columns="groupColumns"
        :ui="{ root: 'rounded-none border-0' }"
      >
        <template #name-cell="{ row }">
          <NuxtLink
            :to="`/groups/${row.original.id}`"
            class="font-medium text-primary hover:underline"
          >
            {{ row.original.name }}
          </NuxtLink>
        </template>
        <template #role-cell="{ row }">
          <span v-if="row.original.role" class="capitalize">
            {{ row.original.role }}
          </span>
          <span v-else class="text-muted">Site admin</span>
        </template>
        <template #empty>
          <TableSkeleton v-if="isLoading(groupsStatus)" :rows="2" />
          <template v-else>No groups yet.</template>
        </template>
      </UTable>
    </DetailPanel>
  </PageContainer>
</template>
