<script setup lang="ts">
import { extractApiErrorMessage } from "~/utils/api-error";
import { getReadableIdError } from "~/utils/readable-id";

definePageMeta({ middleware: "auth" });

interface Profile {
  username: string;
  iconImageUrl: string | null;
  role: "admin" | "member";
}

interface GroupSummary {
  id: string;
  name: string;
  readableId: string;
  kind: "user" | "system";
  // null for a site admin viewing a system group they aren't in.
  role: "admin" | "editor" | "member" | null;
}

const session = await useAuthSession();
const user = computed(() => session.data.value?.user);

const { data: profile, refresh } = await useFetch<Profile>("/api/profile");
const { data: groups } = await useLazyFetch<GroupSummary[]>("/api/group", {
  default: () => [],
});

const form = reactive({
  username: profile.value?.username ?? "",
  iconImageUrl: profile.value?.iconImageUrl ?? "",
});

const username = computed(() => form.username.trim().toLowerCase());
const iconUrl = computed(() => form.iconImageUrl.trim());

const usernameFormatError = computed(() => getReadableIdError(username.value));
const usernameChanged = computed(
  () => username.value !== (profile.value?.username ?? ""),
);

// Live availability check, debounced; only for a changed, well-formed username.
const availability = ref<"idle" | "checking" | "available" | "taken" | "failed">(
  "idle",
);
let checkTimer: ReturnType<typeof setTimeout> | undefined;
watch(username, (value) => {
  clearTimeout(checkTimer);
  if (!value || !usernameChanged.value || usernameFormatError.value) {
    availability.value = "idle";
    return;
  }
  availability.value = "checking";
  checkTimer = setTimeout(async () => {
    try {
      const result = await $fetch<{ available: boolean }>(
        "/api/profile/username-availability",
        { query: { username: value } },
      );
      // Ignore a result for something the user has since edited.
      if (value !== username.value) return;
      availability.value = result.available ? "available" : "taken";
    } catch {
      if (value === username.value) availability.value = "failed";
    }
  }, 350);
});
onBeforeUnmount(() => clearTimeout(checkTimer));

const usernameError = computed(() => {
  if (!username.value) return "Username is required.";
  if (usernameFormatError.value) return usernameFormatError.value;
  if (availability.value === "taken") return "That username is already in use.";
  return undefined;
});
const usernameHint = computed(() => {
  if (availability.value === "checking") return "Checking availability…";
  if (availability.value === "available") return "That username is available.";
  if (availability.value === "failed") return "Could not check availability.";
  return undefined;
});

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

const dirty = computed(() => usernameChanged.value || iconChanged.value);
const canSave = computed(
  () =>
    dirty.value &&
    !usernameError.value &&
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
        ...(usernameChanged.value ? { username: username.value } : {}),
        ...(iconChanged.value ? { iconImageUrl: iconUrl.value || null } : {}),
      },
    });
    await refresh();
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

const groupColumns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "readableId", header: "ID" },
  { accessorKey: "role", header: "Role" },
];
</script>

<template>
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <h1 class="text-2xl font-bold text-highlighted">Profile</h1>

    <UPageCard>
      <template #header>
        <h2 class="text-lg font-semibold text-highlighted">Account</h2>
      </template>

      <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
        <dt class="text-muted">Display Name</dt>
        <dd>{{ user?.name }}</dd>
        <dt class="text-muted">Email</dt>
        <dd>{{ user?.email }}</dd>
        <dt class="text-muted">Site Role</dt>
        <dd>{{ profile?.role === "admin" ? "Admin" : "Member" }}</dd>
      </dl>
    </UPageCard>

    <UPageCard>
      <template #header>
        <h2 class="text-lg font-semibold text-highlighted">Edit Profile</h2>
      </template>

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

        <ReadableIdField
          v-model="form.username"
          name="handle"
          label="Username"
          description="Lowercase letters, numbers, and hyphens."
          :error="usernameError"
        />
        <p
          v-if="usernameHint"
          class="-mt-2 text-sm"
          :class="availability === 'available' ? 'text-success' : 'text-muted'"
        >
          {{ usernameHint }}
        </p>

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
    </UPageCard>

    <UPageCard>
      <template #header>
        <h2 class="text-lg font-semibold text-highlighted">Groups</h2>
      </template>

      <UTable :data="groups" :columns="groupColumns">
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
        <template #empty>No groups yet.</template>
      </UTable>
    </UPageCard>
  </div>
</template>
