<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import {
  API_KEY_ACCESS,
  API_KEY_ACCESS_LABELS,
  API_KEY_EXPIRY_DAYS,
  MAX_API_KEY_NAME_LENGTH,
  type ApiKeyAccess,
} from "#shared/api-keys";
import { extractApiErrorMessage } from "~/utils/api-error";

// The profile page's API Keys section: list, create (the key is shown once),
// and delete the signed-in user's API keys.

interface ApiKeyItem {
  id: string;
  name: string | null;
  start: string | null;
  access: ApiKeyAccess;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

const { data: keys, status, error: listError, refresh } = await useLazyFetch<ApiKeyItem[]>(
  "/api/profile/api-keys",
  { default: () => [] },
);

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "";
}

function isExpired(item: ApiKeyItem) {
  return !!item.expiresAt && new Date(item.expiresAt).getTime() < Date.now();
}

const columns: TableColumn<ApiKeyItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "start", header: "Key" },
  { accessorKey: "access", header: "Access" },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  { accessorKey: "expiresAt", header: "Expires" },
  {
    accessorKey: "lastUsedAt",
    header: "Last Used",
    cell: ({ row }) => formatDate(row.original.lastUsedAt) || "Never",
  },
  { id: "actions" },
];

const accessOptions = API_KEY_ACCESS.map((value) => ({
  label: API_KEY_ACCESS_LABELS[value],
  value,
}));
const NEVER = "never";
const expiryOptions = [
  ...API_KEY_EXPIRY_DAYS.map((days) => ({
    label: `${days} days`,
    value: String(days),
  })),
  { label: "Never", value: NEVER },
];

const isFormOpen = ref(false);
const form = reactive({
  name: "",
  access: "read" as ApiKeyAccess,
  expiry: "90",
});
const formBusy = ref(false);
const formError = ref("");
// The new key, shown once after creating it.
const createdKey = ref("");
const copied = ref(false);

function openCreate() {
  form.name = "";
  form.access = "read";
  form.expiry = "90";
  formError.value = "";
  createdKey.value = "";
  copied.value = false;
  isFormOpen.value = true;
}

async function create() {
  formBusy.value = true;
  formError.value = "";
  try {
    const created = await $fetch<ApiKeyItem & { key: string }>(
      "/api/profile/api-keys",
      {
        method: "POST",
        body: {
          name: form.name.trim(),
          access: form.access,
          expiresInDays: form.expiry === NEVER ? null : Number(form.expiry),
        },
      },
    );
    createdKey.value = created.key;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not create API key.");
  } finally {
    formBusy.value = false;
  }
}

async function copyKey() {
  try {
    await navigator.clipboard.writeText(createdKey.value);
    copied.value = true;
  } catch {
    copied.value = false;
  }
}

// Forget the key once the dialog closes, however it closes.
watch(isFormOpen, (open) => {
  if (!open) createdKey.value = "";
});

const isDeleteOpen = ref(false);
const deletingKey = ref<ApiKeyItem | null>(null);
const deleteBusy = ref(false);
const deleteError = ref("");

function openDelete(item: ApiKeyItem) {
  deletingKey.value = item;
  deleteError.value = "";
  isDeleteOpen.value = true;
}

async function remove() {
  if (!deletingKey.value) return;
  deleteBusy.value = true;
  deleteError.value = "";
  try {
    await $fetch(`/api/profile/api-keys/${deletingKey.value.id}`, {
      method: "DELETE",
    });
    isDeleteOpen.value = false;
    await refresh();
  } catch (error) {
    deleteError.value = extractApiErrorMessage(error, "Could not delete API key.");
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <DetailPanel title="API Keys">
    <template #actions>
      <UButton icon="i-lucide-plus" @click="openCreate">New API Key</UButton>
    </template>

    <div class="space-y-4 p-[18px]">
    <p class="text-sm text-muted">
      Send a key as <code>Authorization: Bearer &lt;key&gt;</code> or
      <code>x-api-key: &lt;key&gt;</code>. A key acts as you; Read Only
      keys can't change anything.
    </p>

    <UAlert
      v-if="listError"
      color="error"
      variant="subtle"
      class="mb-4"
      :description="extractApiErrorMessage(listError, 'Could not load API keys.')"
    />

    <UTable :data="keys" :columns="columns">
      <template #start-cell="{ row }">
        <code class="text-xs">{{ row.original.start }}…</code>
      </template>
      <template #access-cell="{ row }">
        {{ API_KEY_ACCESS_LABELS[row.original.access] }}
      </template>
      <template #expiresAt-cell="{ row }">
        <UBadge
          v-if="isExpired(row.original)"
          color="error"
          variant="subtle"
          label="Expired"
        />
        <span v-else>{{ formatDate(row.original.expiresAt) || "Never" }}</span>
      </template>
      <template #actions-cell="{ row }">
        <div class="flex justify-end">
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="sm"
            :aria-label="`Delete ${row.original.name}`"
            @click="openDelete(row.original)"
          />
        </div>
      </template>
      <template #empty>
        <TableSkeleton v-if="isLoading(status)" :rows="2" />
        <template v-else>No API keys yet.</template>
      </template>
    </UTable>

    <UModal
      v-model:open="isFormOpen"
      :title="createdKey ? 'API Key Created' : 'New API Key'"
    >
      <template #body>
        <div v-if="createdKey" class="space-y-4">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            description="Copy this key now. It won't be shown again."
          />
          <div class="flex gap-2">
            <UInput
              :model-value="createdKey"
              readonly
              class="w-full font-mono"
              aria-label="API key"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <UButton
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copied ? 'Copied' : 'Copy'"
              color="neutral"
              variant="outline"
              @click="copyKey"
            />
          </div>
        </div>
        <UForm
          v-else
          id="api-key-form"
          :state="form"
          class="space-y-4"
          @submit="create"
        >
          <UFormField
            name="name"
            label="Name"
            hint="What the key is for, e.g. a script or tool."
            required
          >
            <UInput
              v-model="form.name"
              class="w-full"
              :maxlength="MAX_API_KEY_NAME_LENGTH"
              autocomplete="off"
              required
            />
          </UFormField>
          <UFormField name="access" label="Access" required>
            <USelect v-model="form.access" :items="accessOptions" class="w-full" />
          </UFormField>
          <UFormField name="expiry" label="Expires" required>
            <USelect v-model="form.expiry" :items="expiryOptions" class="w-full" />
          </UFormField>
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            :description="formError"
          />
        </UForm>
      </template>

      <template #footer="{ close }">
        <UButton v-if="createdKey" label="Done" @click="close" />
        <template v-else>
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="close"
          />
          <UButton
            type="submit"
            form="api-key-form"
            label="Create"
            :loading="formBusy"
            :disabled="!form.name.trim()"
          />
        </template>
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete API Key"
      :description="`Delete &quot;${deletingKey?.name}&quot;? Anything using it stops working at once. This action cannot be undone.`"
      :ui="{ footer: 'justify-end' }"
    >
      <template v-if="deleteError" #body>
        <UAlert color="error" variant="subtle" :description="deleteError" />
      </template>

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
          :loading="deleteBusy"
          @click="remove"
        />
      </template>
    </UModal>
    </div>
  </DetailPanel>
</template>
