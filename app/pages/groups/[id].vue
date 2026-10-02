<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { formatUserLabel } from "#shared/display-name";
import { extractApiErrorMessage } from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

type GroupRole = "admin" | "editor" | "member";

interface GroupDetail {
  id: string;
  readableId: string;
  name: string;
  kind: "user" | "system";
  // null for a site admin viewing a system group they aren't in.
  role: GroupRole | null;
  canManage: boolean;
}

interface Member {
  userId: string;
  name: string;
  username: string | null;
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
const isAdmin = computed(() => group.value?.canManage ?? false);

const {
  data: members,
  status: membersStatus,
  refresh: refreshMembers,
} = await useLazyFetch<Member[]>(`/api/group/${id}/members`, {
  default: () => [],
});

const memberColumns = computed<TableColumn<Member>[]>(() => [
  { accessorKey: "name", header: "Display Name" },
  { accessorKey: "username", header: "Username" },
  { accessorKey: "role", header: "Role" },
  ...(isAdmin.value ? [{ id: "actions" }] : []),
]);

// Member changes surface errors in one alert above the table.
const memberError = ref("");
const memberBusy = ref(false);

async function saveMember(body: {
  userId?: string;
  username?: string;
  role: GroupRole;
}) {
  memberBusy.value = true;
  memberError.value = "";
  try {
    await $fetch(`/api/group/${id}/members`, { method: "POST", body });
    await Promise.all([refreshMembers(), refreshSystems()]);
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

const addForm = reactive({ username: "", role: "member" as GroupRole });

async function addMember() {
  if (!addForm.username.trim() || memberBusy.value) return;
  const added = await saveMember({
    username: addForm.username.trim(),
    role: addForm.role,
  });
  if (added) {
    addForm.username = "";
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
    await Promise.all([refreshMembers(), refreshSystems()]);
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
const form = reactive({ readableId: "", name: "" });
const formBusy = ref(false);
const formError = ref("");
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(form);
const idAvailability = useResourceIdAvailability(form, "group", () => group.value ?? undefined);

function openEdit() {
  if (!group.value) return;
  formError.value = "";
  form.readableId = group.value.readableId;
  form.name = group.value.name;
  resetReadableIdTouched(true);
  isFormOpen.value = true;
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    await $fetch(`/api/group/${id}`, {
      method: "PATCH",
      body: { readableId: form.readableId, name: form.name },
    });
    isFormOpen.value = false;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not save group.");
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
    await refreshSystems();
    await navigateTo("/groups");
  } catch (error) {
    deleteError.value = extractApiErrorMessage(
      error,
      "Could not delete group.",
    );
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <template v-if="group">
      <DetailHeader
        back-to="/groups"
        back-label="Back to Groups"
        eyebrow="Group"
        :title="group.name"
      >
        <template #meta>
          <ReadableIdBadge :readable-id="group.readableId" />
          <UBadge
            v-if="group.kind === 'system'"
            class="rounded-full font-bold"
          >
            Official
          </UBadge>
        </template>
        <template v-if="isAdmin" #actions>
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
        </template>
      </DetailHeader>

      <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <DetailPanel title="Members">
        <div class="space-y-4 p-[18px]">
          <!-- Deliberately not a <form>, and nothing says "username" in the
               name/placeholder: Firefox treats a lone username-like field in a
               form as a login form and autofills saved credentials, ignoring
               autocomplete="off". -->
          <div v-if="isAdmin" class="flex flex-wrap items-end gap-2">
            <UFormField label="Username" class="min-w-48 flex-1">
              <UInput
                v-model="addForm.username"
                placeholder="their-username"
                class="w-full"
                autocomplete="off"
                autocapitalize="none"
                :spellcheck="false"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                @keydown.enter.prevent="addMember"
              />
            </UFormField>
            <UFormField label="Role">
              <USelect
                v-model="addForm.role"
                :items="roleOptions"
                class="w-32"
              />
            </UFormField>
            <UButton
              icon="i-lucide-user-plus"
              :loading="memberBusy"
              :disabled="!addForm.username.trim()"
              @click="addMember"
            >
              Add
            </UButton>
          </div>

          <UAlert
            v-if="memberError"
            color="error"
            variant="subtle"
            :description="memberError"
          />

        </div>

          <UTable
            :data="members"
            :ui="{ root: 'rounded-none border-0 border-t border-default' }"
            :columns="memberColumns"
            :loading="membersStatus === 'pending'"
          >
            <template #empty>
              <TableSkeleton v-if="isLoading(membersStatus)" :rows="3" />
              <p v-else class="py-6 text-center text-sm text-muted">No members.</p>
            </template>

            <template #username-cell="{ row }">
              <span class="text-muted">{{ row.original.username ? `@${row.original.username}` : "—" }}</span>
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
                :aria-label="`Remove ${formatUserLabel(row.original.name, row.original.username)}`"
                @click="removeMember(row.original)"
              />
            </template>
          </UTable>
      </DetailPanel>

      <AboutPanel
        :facts="[
          { label: 'ID', value: group.readableId, mono: true },
          { label: 'Kind', value: group.kind === 'system' ? 'Official' : 'Community' },
          { label: 'Your role', value: group.role ? group.role.charAt(0).toUpperCase() + group.role.slice(1) : 'Site admin' },
          { label: 'Members', value: isLoading(membersStatus) ? null : members.length },
        ]"
      />
      </div>
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
          <ReadableIdField
            :model-value="form.readableId"
            :availability="idAvailability"
            :error="readableIdError"
            @update:model-value="onReadableIdInput"
          />
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
  </PageContainer>
</template>
