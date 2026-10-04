<script setup lang="ts">
import type { ResourceSource } from "#shared/resource-list";
import { extractApiErrorMessage } from "~/utils/api-error";
import type { TableColumn } from "@nuxt/ui";

definePageMeta({ middleware: "auth" });

interface CampaignItem {
  id: string;
  source: ResourceSource;
  readableId: string;
  // The owner's username or group ID, for the `owner/id` address.
  ownerReadableId: string | null;
  name: string;
  systemId: string;
  isPubliclyReadable: boolean;
  updatedAt: string;
  canEdit: boolean;
  ownerGroupId: string | null;
  canChangeOwner: boolean;
}

// The page needs an account (auth middleware), so visitors never reach it.
const loggedIn = await useLoggedIn();
const { systemId: currentSystemId } = useCurrentSystem();
const list = await useResourceList<CampaignItem>("/api/campaign", loggedIn, { bySystem: true });
const { items: campaigns, status, refresh } = list;

const { systems, status: systemsStatus } = useSystems();

const systemOptions = computed(() =>
  systems.value.map((system) =>
    resourceOption(system.id, { name: system.name, source: system.source }),
  ),
);

const columns: TableColumn<CampaignItem>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "source", header: "Source" },
  { accessorKey: "systemId", header: "System" },
  { accessorKey: "isPubliclyReadable", header: "Visibility" },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => formatShortDate(row.original.updatedAt),
  },
  actionsColumn(),
];

const isFormOpen = ref(false);
const editingCampaign = ref<CampaignItem | null>(null);
const form = reactive({
  readableId: "",
  name: "",
  systemId: "",
  isPubliclyReadable: false,
  ownerGroupId: null as string | null,
});
const formBusy = ref(false);
const formError = ref("");
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(form);
const idAvailability = useResourceIdAvailability(form, "campaign", () => editingCampaign.value ?? undefined);

function openCreate() {
  const firstSystem =
    systems.value.find((item) => item.id === currentSystemId.value) ??
    systems.value[0];
  editingCampaign.value = null;
  formError.value = "";
  form.readableId = "";
  form.name = "";
  form.systemId = firstSystem?.id ?? "";
  form.isPubliclyReadable = false;
  form.ownerGroupId = null;
  resetReadableIdTouched(false);
  isFormOpen.value = true;
}

// `?new=1` (the dashboard's "Create one" link) opens the New dialog once the
// systems have loaded, then drops that query param so a refresh doesn't reopen it.
const route = useRoute();
const router = useRouter();
// Only after mount, so the dialog doesn't open mid-hydration.
let mounted = false;
function openNewFromQuery() {
  if (!mounted || route.query.new === undefined) return;
  if (isLoading(systemsStatus.value)) return;
  if (systemsStatus.value === "success" && loggedIn.value) openCreate();
  const { new: _new, ...rest } = route.query;
  router.replace({ query: rest });
}
watch(systemsStatus, openNewFromQuery);
onMounted(() => {
  mounted = true;
  openNewFromQuery();
});

function openEdit(item: CampaignItem) {
  form.ownerGroupId = item.ownerGroupId;
  editingCampaign.value = item;
  formError.value = "";
  form.readableId = item.readableId;
  form.name = item.name;
  form.systemId = item.systemId;
  form.isPubliclyReadable = item.isPubliclyReadable;
  resetReadableIdTouched(true);
  isFormOpen.value = true;
}

// Sends ownerGroupId only when the Owner field changed it.
function ownerChange(item: CampaignItem) {
  return form.ownerGroupId !== item.ownerGroupId
    ? { ownerGroupId: form.ownerGroupId }
    : {};
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    if (editingCampaign.value) {
      await $fetch(`/api/campaign/${editingCampaign.value.id}`, {
        method: "PATCH",
        body: {
          readableId: form.readableId,
          name: form.name,
          isPubliclyReadable: form.isPubliclyReadable,
          ...ownerChange(editingCampaign.value),
        },
      });
    } else {
      await $fetch("/api/campaign", {
        method: "POST",
        body: {
          readableId: form.readableId,
          name: form.name,
          systemId: form.systemId,
          isPubliclyReadable: form.isPubliclyReadable,
          ownerGroupId: form.ownerGroupId ?? undefined,
        },
      });
    }

    isFormOpen.value = false;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not save campaign.");
  } finally {
    formBusy.value = false;
  }
}

const isDeleteOpen = ref(false);
const deletingCampaign = ref<CampaignItem | null>(null);
const deleteBusy = ref(false);
const deleteError = ref("");

function confirmDelete(item: CampaignItem) {
  deleteError.value = "";
  deletingCampaign.value = item;
  isDeleteOpen.value = true;
}

async function remove() {
  if (!deletingCampaign.value) return;
  deleteBusy.value = true;
  deleteError.value = "";

  try {
    await $fetch(`/api/campaign/${deletingCampaign.value.id}`, { method: "DELETE" });
    isDeleteOpen.value = false;
    await refresh();
  } catch (error) {
    deleteError.value = extractApiErrorMessage(
      error,
      "Could not delete campaign.",
    );
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <PageHeader section="play" title="Campaigns">
      <UButton
        icon="i-lucide-plus"
        :disabled="systems.length === 0"
        @click="openCreate"
      >
        New Campaign
      </UButton>
    </PageHeader>
    <p v-if="systemsStatus === 'success' && systems.length === 0" class="text-sm text-muted">
      Create a system before adding campaigns.
    </p>

    <ResourceList
      :list="list"
      noun="Campaigns"
      singular="campaign"
      view-key="campaigns"
      default-view="cards"
    >
<UTable :data="campaigns" :columns="columns" :loading="status === 'pending'">
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/campaigns/${row.original.id}`"
          class="text-[15px] font-bold text-highlighted hover:text-primary hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
        <span class="mt-0.5 block font-mono text-xs text-muted">
          {{ resourceAddress(row.original.ownerReadableId, row.original.readableId) }}
        </span>
      </template>

      <template #systemId-cell="{ row }">
        <SystemLink :system-id="row.original.systemId" />
      </template>

      <template #source-cell="{ row }">
        <SourceBadge :source="row.original.source" />
      </template>

      <template #isPubliclyReadable-cell="{ row }">
        <VisibilityBadge
          :is-publicly-readable="row.original.isPubliclyReadable"
        />
      </template>

      <template #actions-cell="{ row }">
        <ResourceActionsMenu
          :can-edit="row.original.canEdit"
          :view-to="`/campaigns/${row.original.id}`"
          :name="row.original.name" @edit="openEdit(row.original)"
          @delete="confirmDelete(row.original)"
        />
      </template>

      <template #empty>
        <ResourceListEmpty :list="list" plural="campaigns" create-label="New Campaign" :create-disabled="systems.length === 0" @create="openCreate()" />
      </template>
    </UTable>
          <template #cards>
        <ResourceCards :items="campaigns" :to="(item) => `/campaigns/${item.id}`">
          <template #actions="{ item }">
            <ResourceActionsMenu
              :can-edit="item.canEdit"
              :view-to="`/campaigns/${item.id}`"
              :name="item.name" @edit="openEdit(item)"
              @delete="confirmDelete(item)"
            />
          </template>
      <template #details="{ item }">
          <dt class="text-muted">System</dt>
          <dd><SystemLink :system-id="item.systemId" /></dd>
      </template>
          <template #empty>
            <ResourceListEmpty :list="list" plural="campaigns" create-label="New Campaign" :create-disabled="systems.length === 0" @create="openCreate()" />
          </template>
        </ResourceCards>
      </template>
    </ResourceList>

    <UModal
      v-model:open="isFormOpen"
      :title="editingCampaign ? 'Edit Campaign' : 'New Campaign'"
    >
      <template #body>
        <UForm
          id="campaign-form"
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
          <UFormField name="systemId" label="System" required>
            <USelect
              v-model="form.systemId"
              :items="systemOptions"
              class="w-full"
              :disabled="!!editingCampaign"
            >
              <template #item-label="{ item }">
                <ResourceOption :option="item as ResourceOptionItem" />
              </template>
            </USelect>
          </UFormField>
          <OwnerField
            v-if="!editingCampaign || editingCampaign.canChangeOwner"
            v-model="form.ownerGroupId"
            :original="editingCampaign ? editingCampaign.ownerGroupId : undefined"
          />
          <VisibilityField v-model="form.isPubliclyReadable" />
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
          form="campaign-form"
          label="Save"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete Campaign"
      :description="`Are you sure you want to delete &quot;${deletingCampaign?.name}&quot;? This action cannot be undone.`"
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
