<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { extractApiErrorMessage } from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

type GroupRole = "admin" | "editor" | "member";

interface GroupDetail {
  id: string;
  slug: string;
  name: string;
  role: GroupRole;
}

interface Member {
  userId: string;
  name: string;
  slug: string | null;
  role: GroupRole;
}

const roleOptions: { label: string; value: GroupRole }[] = [
  { label: "Admin", value: "admin" },
  { label: "Editor", value: "editor" },
  { label: "Member", value: "member" },
];

const route = useRoute();
const id = route.params.id as string;

const session = await useAuthSession();
const currentUserId = computed(() => session.data.value?.user.id);

const { data: group, refresh } = await useFetch<GroupDetail>(
  `/api/group/${id}`,
);
const isAdmin = computed(() => group.value?.role === "admin");

const {
  data: members,
  status: membersStatus,
  refresh: refreshMembers,
} = await useLazyFetch<Member[]>(`/api/group/${id}/members`, {
  default: () => [],
});

const memberColumns = computed<TableColumn<Member>[]>(() => [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "slug", header: "Username" },
  { accessorKey: "role", header: "Role" },
  ...(isAdmin.value ? [{ id: "actions" }] : []),
]);

// Member changes surface errors in one alert above the table.
const memberError = ref("");
const memberBusy = ref(false);

async function saveMember(body: {
  userId?: string;
  slug?: string;
  role: GroupRole;
}) {
  memberBusy.value = true;
  memberError.value = "";
  try {
    await $fetch(`/api/group/${id}/members`, { method: "POST", body });
    await refreshMembers();
    return true;
  } catch (error) {
    memberError.value = extractApiErrorMessage(
      error,
      "Could not update member.",
    );
    return false;
  } finally {
    memberBusy.value = false;
  }
}

async function changeRole(member: Member, role: GroupRole) {
  if (role === member.role) return;
  await saveMember({ userId: member.userId, role });
  // The admin may have just demoted themselves.
  if (member.userId === currentUserId.value) await refresh();
}

const addForm = reactive({ slug: "", role: "member" as GroupRole });

async function addMember() {
  const added = await saveMember({
    slug: addForm.slug.trim(),
    role: addForm.role,
  });
  if (added) {
    addForm.slug = "";
    addForm.role = "member";
  }
}

async function removeMember(member: Member) {
  memberBusy.value = true;
  memberError.value = "";
  try {
    await $fetch(`/api/group/${id}/members/${member.userId}`, {
      method: "DELETE",
    });
    await refreshMembers();
  } catch (error) {
    memberError.value = extractApiErrorMessage(
      error,
      "Could not remove member.",
    );
  } finally {
    memberBusy.value = false;
  }
}

const isFormOpen = ref(false);
const form = reactive({ slug: "", name: "" });
const formBusy = ref(false);
const formError = ref("");
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);

function openEdit() {
  if (!group.value) return;
  formError.value = "";
  form.slug = group.value.slug;
  form.name = group.value.name;
  resetSlugTouched(true);
  isFormOpen.value = true;
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    await $fetch(`/api/group/${id}`, {
      method: "PATCH",
      body: { slug: form.slug, name: form.name },
    });
    isFormOpen.value = false;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not save Group.");
  } finally {
    formBusy.value = false;
  }
}

const isDeleteOpen = ref(false);
const deleteBusy = ref(false);
const deleteError = ref("");

async function remove() {
  deleteBusy.value = true;
  deleteError.value = "";

  try {
    await $fetch(`/api/group/${id}`, { method: "DELETE" });
    await navigateTo("/groups");
  } catch (error) {
    deleteError.value = extractApiErrorMessage(
      error,
      "Could not delete Group.",
    );
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <UButton
      to="/groups"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      size="sm"
    >
      Back to Groups
    </UButton>

    <template v-if="group">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-highlighted">
            {{ group.name }}
          </h1>
          <p class="text-sm text-muted">
            {{ group.slug }} · You are
            <span class="capitalize">{{ group.role }}</span>
          </p>
        </div>
        <div v-if="isAdmin" class="flex gap-2">
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            @click="openEdit"
          >
            Edit
          </UButton>
          <UButton
            icon="i-lucide-trash"
            color="error"
            variant="outline"
            @click="
              deleteError = '';
              isDeleteOpen = true;
            "
          >
            Delete
          </UButton>
        </div>
      </div>

      <UPageCard>
        <template #header>
          <h2 class="text-lg font-semibold text-highlighted">Members</h2>
        </template>

        <div class="space-y-4">
          <UForm
            v-if="isAdmin"
            :state="addForm"
            class="flex flex-wrap items-end gap-2"
            @submit="addMember"
          >
            <UFormField name="slug" label="Username" class="min-w-48 flex-1">
              <UInput
                v-model="addForm.slug"
                placeholder="their-username"
                class="w-full"
                required
              />
            </UFormField>
            <UFormField name="role" label="Role">
              <USelect
                v-model="addForm.role"
                :items="roleOptions"
                class="w-32"
              />
            </UFormField>
            <UButton
              type="submit"
              icon="i-lucide-user-plus"
              :loading="memberBusy"
            >
              Add
            </UButton>
          </UForm>

          <UAlert
            v-if="memberError"
            color="error"
            variant="subtle"
            :description="memberError"
          />

          <UTable
            :data="members"
            :columns="memberColumns"
            :loading="membersStatus === 'pending'"
          >
            <template #slug-cell="{ row }">
              <span class="text-muted">{{ row.original.slug ?? "—" }}</span>
            </template>

            <template #role-cell="{ row }">
              <USelect
                v-if="isAdmin"
                :model-value="row.original.role"
                :items="roleOptions"
                :disabled="memberBusy"
                size="sm"
                class="w-32"
                @update:model-value="
                  (role) => changeRole(row.original, role as GroupRole)
                "
              />
              <span v-else class="capitalize">{{ row.original.role }}</span>
            </template>

            <template #actions-cell="{ row }">
              <UButton
                v-if="row.original.userId !== currentUserId"
                icon="i-lucide-user-minus"
                color="error"
                variant="ghost"
                size="sm"
                :disabled="memberBusy"
                :aria-label="`Remove ${row.original.name}`"
                @click="removeMember(row.original)"
              />
            </template>
          </UTable>
        </div>
      </UPageCard>
    </template>

    <UModal v-model:open="isFormOpen" title="Edit Group">
      <template #body>
        <UForm
          id="group-detail-form"
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
          form="group-detail-form"
          label="Save"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete Group"
      :description="`Are you sure you want to delete &quot;${group?.name}&quot;? This action cannot be undone.`"
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
</template>
