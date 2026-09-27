<script setup lang="ts">
import { extractApiErrorMessage } from "~/utils/api-error";
import type { TableColumn } from "@nuxt/ui";

definePageMeta({ middleware: "auth" });

interface GameItem {
  id: string;
  slug: string;
  name: string;
  systemId: string;
  isPubliclyReadable: boolean;
  updatedAt: string;
}

interface SystemOption {
  id: string;
  name: string;
}

const {
  data: games,
  status,
  refresh,
} = await useLazyFetch<GameItem[]>("/api/game", { default: () => [] });

const { data: systems } = await useLazyFetch<SystemOption[]>("/api/system", {
  default: () => [],
});

const systemOptions = computed(() =>
  systems.value.map((system) => ({ label: system.name, value: system.id })),
);

function systemName(systemId: string) {
  return (
    systems.value.find((system) => system.id === systemId)?.name ?? "Unknown"
  );
}

const columns: TableColumn<GameItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "slug", header: "Slug" },
  { accessorKey: "systemId", header: "System" },
  { accessorKey: "isPubliclyReadable", header: "Public" },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
  },
  { id: "actions" },
];

const isFormOpen = ref(false);
const editingGame = ref<GameItem | null>(null);
const form = reactive({
  slug: "",
  name: "",
  systemId: "",
  isPubliclyReadable: false,
});
const formBusy = ref(false);
const formError = ref("");
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);

function openCreate() {
  const firstSystem = systems.value[0];
  editingGame.value = null;
  formError.value = "";
  form.slug = "";
  form.name = "";
  form.systemId = firstSystem?.id ?? "";
  form.isPubliclyReadable = false;
  resetSlugTouched(false);
  isFormOpen.value = true;
}

function openEdit(item: GameItem) {
  editingGame.value = item;
  formError.value = "";
  form.slug = item.slug;
  form.name = item.name;
  form.systemId = item.systemId;
  form.isPubliclyReadable = item.isPubliclyReadable;
  resetSlugTouched(true);
  isFormOpen.value = true;
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    if (editingGame.value) {
      await $fetch(`/api/game/${editingGame.value.id}`, {
        method: "PATCH",
        body: {
          slug: form.slug,
          name: form.name,
          isPubliclyReadable: form.isPubliclyReadable,
        },
      });
    } else {
      await $fetch("/api/game", {
        method: "POST",
        body: {
          slug: form.slug,
          name: form.name,
          systemId: form.systemId,
          isPubliclyReadable: form.isPubliclyReadable,
        },
      });
    }

    isFormOpen.value = false;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not save Game.");
  } finally {
    formBusy.value = false;
  }
}

const isDeleteOpen = ref(false);
const deletingGame = ref<GameItem | null>(null);
const deleteBusy = ref(false);

function confirmDelete(item: GameItem) {
  deletingGame.value = item;
  isDeleteOpen.value = true;
}

async function remove() {
  if (!deletingGame.value) return;
  deleteBusy.value = true;

  try {
    await $fetch(`/api/game/${deletingGame.value.id}`, { method: "DELETE" });
    isDeleteOpen.value = false;
    await refresh();
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-highlighted">Games</h1>
      <UButton
        icon="i-lucide-plus"
        size="sm"
        :disabled="systems.length === 0"
        @click="openCreate"
      >
        New Game
      </UButton>
    </div>
    <p v-if="systems.length === 0" class="text-sm text-muted">
      Create a System before adding Games.
    </p>

    <UTable :data="games" :columns="columns" :loading="status === 'pending'">
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/games/${row.original.id}`"
          class="font-medium text-highlighted hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
      </template>

      <template #systemId-cell="{ row }">
        {{ systemName(row.original.systemId) }}
      </template>

      <template #isPubliclyReadable-cell="{ row }">
        <UBadge
          :color="row.original.isPubliclyReadable ? 'primary' : 'neutral'"
          variant="subtle"
        >
          {{ row.original.isPubliclyReadable ? "Public" : "Private" }}
        </UBadge>
      </template>

      <template #actions-cell="{ row }">
        <UDropdownMenu
          :items="[
            [
              {
                label: 'Edit',
                icon: 'i-lucide-pencil',
                onSelect: () => openEdit(row.original),
              },
            ],
            [
              {
                label: 'Delete',
                icon: 'i-lucide-trash',
                color: 'error',
                onSelect: () => confirmDelete(row.original),
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
        <p class="py-6 text-center text-sm text-muted">No Games yet.</p>
      </template>
    </UTable>

    <UModal
      v-model:open="isFormOpen"
      :title="editingGame ? 'Edit Game' : 'New Game'"
    >
      <template #body>
        <UForm
          id="game-form"
          :state="form"
          class="space-y-4"
          @submit="submitForm"
        >
          <UFormField name="name" label="Name" required>
            <UInput v-model="form.name" class="w-full" required />
          </UFormField>
          <UFormField
            name="slug"
            label="Slug"
            description="Auto-generated from the name — edit if you need something different or unique."
            :error="slugError"
            required
          >
            <UInput
              :model-value="form.slug"
              class="w-full"
              required
              @update:model-value="onSlugInput"
            />
          </UFormField>
          <UFormField name="systemId" label="System" required>
            <USelect
              v-model="form.systemId"
              :items="systemOptions"
              class="w-full"
              :disabled="!!editingGame"
            />
          </UFormField>
          <UFormField name="isPubliclyReadable" label="Publicly readable">
            <USwitch v-model="form.isPubliclyReadable" />
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
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="close"
        />
        <UButton
          type="submit"
          form="game-form"
          label="Save"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete Game"
      :description="`Are you sure you want to delete &quot;${deletingGame?.name}&quot;? This action cannot be undone.`"
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
          :loading="deleteBusy"
          @click="remove"
        />
      </template>
    </UModal>
  </div>
</template>
