<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent, TableColumn } from "@nuxt/ui";
import { authClient } from "~/utils/auth-client";

type AuthMode = "login" | "register";
type AuthFormData = { name?: string; email: string; password: string };

type DataTab = "content" | "characters" | "games";

interface ContentItem {
  id: string;
  name: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

const mode = ref<AuthMode>("login");
const busy = ref(false);
const errorMessage = ref("");

const sessionState = await authClient.useSession(useFetch);
const isLoggedIn = computed(() => !!sessionState.data.value?.user);

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

// Characters and games have no backing data yet — dashboard tabs are placeholders.
const dataTabs = [
  {
    label: "Content",
    value: "content" as DataTab,
    icon: "i-lucide-file-text",
  },
  {
    label: "Characters",
    value: "characters" as DataTab,
    icon: "i-lucide-users",
  },
  { label: "Games", value: "games" as DataTab, icon: "i-lucide-dice-5" },
];
const activeTab = ref<DataTab>("content");

const {
  data: contentItems,
  status: contentStatus,
  refresh: refreshContent,
} = useLazyFetch<ContentItem[]>("/api/content", {
  default: () => [],
  immediate: false,
});

watch(
  isLoggedIn,
  (loggedIn) => {
    if (loggedIn) refreshContent();
  },
  { immediate: true },
);

const contentColumns: TableColumn<ContentItem>[] = [
  { accessorKey: "displayName", header: "Display name" },
  { accessorKey: "name", header: "Name" },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
  },
  { id: "actions" },
];

const isContentFormOpen = ref(false);
const editingContent = ref<ContentItem | null>(null);
const contentForm = reactive({ name: "", displayName: "" });
const contentFormBusy = ref(false);

function openCreateContent() {
  editingContent.value = null;
  contentForm.name = "";
  contentForm.displayName = "";
  isContentFormOpen.value = true;
}

function openEditContent(item: ContentItem) {
  editingContent.value = item;
  contentForm.name = item.name;
  contentForm.displayName = item.displayName;
  isContentFormOpen.value = true;
}

async function submitContentForm() {
  contentFormBusy.value = true;

  try {
    if (editingContent.value) {
      await $fetch(`/api/content/${editingContent.value.id}`, {
        method: "PATCH",
        body: { name: contentForm.name, displayName: contentForm.displayName },
      });
    } else {
      await $fetch("/api/content", {
        method: "POST",
        body: { name: contentForm.name, displayName: contentForm.displayName },
      });
    }

    isContentFormOpen.value = false;
    await refreshContent();
  } finally {
    contentFormBusy.value = false;
  }
}

const isDeleteContentOpen = ref(false);
const deletingContent = ref<ContentItem | null>(null);
const deleteContentBusy = ref(false);

function confirmDeleteContent(item: ContentItem) {
  deletingContent.value = item;
  isDeleteContentOpen.value = true;
}

async function deleteContent() {
  if (!deletingContent.value) return;
  deleteContentBusy.value = true;

  try {
    await $fetch(`/api/content/${deletingContent.value.id}`, {
      method: "DELETE",
    });
    isDeleteContentOpen.value = false;
    await refreshContent();
  } finally {
    deleteContentBusy.value = false;
  }
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
          Brand or section label
        </UBadge>
        <h1 class="text-4xl font-bold text-highlighted sm:text-5xl">
          Page heading placeholder
        </h1>
        <p class="text-lg text-muted">
          Placeholder for introductory copy. Replace this text with your own
          page content.
        </p>
      </div>

      <UPageCard class="w-full max-w-sm">
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
            <UAlert
              color="error"
              variant="subtle"
              :description="errorMessage"
            />
          </template>

          <template #footer>
            <p class="text-center text-sm text-muted">
              Optional supporting text placeholder.
            </p>
          </template>
        </UAuthForm>
      </UPageCard>
    </div>

    <div v-else class="space-y-6 py-8">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-highlighted">Dashboard</h1>
          <p class="text-sm text-muted">
            Signed in as {{ sessionState.data.value?.user.name }}
          </p>
        </div>
        <UButton
          color="neutral"
          variant="outline"
          :loading="busy"
          @click="signOut"
        >
          Sign out
        </UButton>
      </div>

      <UTabs
        v-model="activeTab"
        :items="dataTabs"
        :content="false"
        class="w-full"
      />

      <UPageCard v-if="activeTab === 'content'">
        <template #header>
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-lg font-semibold text-highlighted">Content</h2>
            <UButton icon="i-lucide-plus" size="sm" @click="openCreateContent">
              New content
            </UButton>
          </div>
        </template>

        <UTable
          :data="contentItems"
          :columns="contentColumns"
          :loading="contentStatus === 'pending'"
        >
          <template #actions-cell="{ row }">
            <UDropdownMenu
              :items="[
                [
                  {
                    label: 'Edit',
                    icon: 'i-lucide-pencil',
                    onSelect: () => openEditContent(row.original),
                  },
                ],
                [
                  {
                    label: 'Delete',
                    icon: 'i-lucide-trash',
                    color: 'error',
                    onSelect: () => confirmDeleteContent(row.original),
                  },
                ],
              ]"
            >
              <UButton
                icon="i-lucide-ellipsis"
                color="neutral"
                variant="ghost"
                size="sm"
              />
            </UDropdownMenu>
          </template>

          <template #empty>
            <p class="py-6 text-center text-sm text-muted">
              No content yet. Create your first entry to get started.
            </p>
          </template>
        </UTable>
      </UPageCard>

      <UPageCard v-else-if="activeTab === 'characters'">
        <div class="flex flex-col items-center gap-3 py-12 text-center">
          <UIcon name="i-lucide-users" class="size-10 text-muted" />
          <p class="text-muted">
            Characters aren't set up yet — this section is coming later.
          </p>
        </div>
      </UPageCard>

      <UPageCard v-else>
        <div class="flex flex-col items-center gap-3 py-12 text-center">
          <UIcon name="i-lucide-dice-5" class="size-10 text-muted" />
          <p class="text-muted">
            Games aren't set up yet — this section is coming later.
          </p>
        </div>
      </UPageCard>
    </div>

    <UModal
      v-model:open="isContentFormOpen"
      :title="editingContent ? 'Edit content' : 'New content'"
    >
      <template #body>
        <UForm
          id="content-form"
          :state="contentForm"
          class="space-y-4"
          @submit="submitContentForm"
        >
          <UFormField name="displayName" label="Display name" required>
            <UInput v-model="contentForm.displayName" class="w-full" />
          </UFormField>
          <UFormField name="name" label="Name" required>
            <UInput v-model="contentForm.name" class="w-full" />
          </UFormField>
        </UForm>
      </template>

      <template #footer="{ close }">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="close"
        />
        <UButton
          type="submit"
          form="content-form"
          label="Save"
          :loading="contentFormBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteContentOpen"
      title="Delete content"
      :description="`Are you sure you want to delete &quot;${deletingContent?.displayName}&quot;? This action cannot be undone.`"
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer="{ close }">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="close"
        />
        <UButton
          label="Delete"
          color="error"
          :loading="deleteContentBusy"
          @click="deleteContent"
        />
      </template>
    </UModal>
  </div>
</template>
