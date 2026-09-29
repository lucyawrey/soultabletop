<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { extractApiErrorMessage } from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

type GroupRole = "admin" | "editor" | "member";

interface GroupItem {
  id: string;
  slug: string;
  name: string;
  kind: "user" | "system";
  // null for a system group a site admin isn't in.
  role: GroupRole | null;
  memberCount: number;
}

const {
  data: groups,
  status,
  refresh,
} = await useLazyFetch<GroupItem[]>("/api/group", { default: () => [] });

const columns: TableColumn<GroupItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "slug", header: "Slug" },
  { accessorKey: "role", header: "Your Role" },
  { accessorKey: "memberCount", header: "Members" },
];

const isFormOpen = ref(false);
const form = reactive({ slug: "", name: "", official: false });

// Only site admins can create official (system) groups.
const { data: profile } = await useLazyFetch<{ role: "member" | "admin" }>(
  "/api/profile",
);
const isSiteAdmin = computed(() => profile.value?.role === "admin");
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);
const formBusy = ref(false);
const formError = ref("");

function openCreate() {
  formError.value = "";
  form.slug = "";
  form.name = "";
  form.official = false;
  resetSlugTouched(false);
  isFormOpen.value = true;
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    await $fetch("/api/group", {
      method: "POST",
      body: {
        slug: form.slug,
        name: form.name,
        ...(form.official ? { official: true } : {}),
      },
    });
    isFormOpen.value = false;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not create group.");
  } finally {
    formBusy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-highlighted">Groups</h1>
      <UButton icon="i-lucide-plus" size="sm" @click="openCreate">
        New Group
      </UButton>
    </div>

    <UTable :data="groups" :columns="columns" :loading="status === 'pending'">
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/groups/${row.original.id}`"
          class="font-medium text-highlighted hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
        <UBadge
          v-if="row.original.kind === 'system'"
          variant="subtle"
          size="sm"
          class="ms-2"
        >
          Official
        </UBadge>
      </template>

      <template #role-cell="{ row }">
        <span v-if="!row.original.role" class="text-sm text-muted">
          Site admin
        </span>
        <UBadge
          v-else
          :color="row.original.role === 'admin' ? 'primary' : 'neutral'"
          variant="subtle"
          class="capitalize"
        >
          {{ row.original.role }}
        </UBadge>
      </template>

      <template #empty>
        <p class="py-6 text-center text-sm text-muted">
          You aren't in any groups yet.
        </p>
      </template>
    </UTable>

    <UModal v-model:open="isFormOpen" title="New Group">
      <template #body>
        <UForm
          id="group-form"
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
          <UFormField
            v-if="isSiteAdmin"
            name="official"
            label="Official group"
            description="Resources it owns are official. Site admins can manage it."
          >
            <USwitch v-model="form.official" />
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
          form="group-form"
          label="Create"
          :loading="formBusy"
        />
      </template>
    </UModal>
  </div>
</template>
