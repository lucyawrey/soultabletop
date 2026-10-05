<script setup lang="ts">
import type { ResourceSource } from "#shared/resource-list";
import { extractApiErrorMessage } from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

interface CampaignDetail {
  id: string;
  readableId: string;
  ownerReadableId: string | null;
  source: ResourceSource;
  name: string;
  isPubliclyReadable: boolean;
  updatedAt: string;
  systemId?: string;
  canEdit: boolean;
  canDelete: boolean;
  ownerGroupId: string | null;
  canChangeOwner: boolean;
}

interface SystemOption {
  id: string;
  name: string;
}

const { followSystem } = useCurrentSystem();
const { data: campaign, refresh } = await useResourceFetch<CampaignDetail>("/api/campaign");
useReadableAddress("campaigns", campaign);
// The route may address the campaign by owner + readable ID; changes go by ID.
const id = computed(() => campaign.value?.id ?? "");
followSystem(campaign.value?.systemId);

const { data: systems } = await useLazyFetch<SystemOption[]>("/api/system", {
  default: () => [],
});

const system = computed(() =>
  systems.value.find((item) => item.id === campaign.value?.systemId),
);

const isFormOpen = ref(false);
const form = reactive({
  readableId: "",
  name: "",
  isPubliclyReadable: false,
  ownerGroupId: null as string | null,
});
const formBusy = ref(false);
const formError = ref("");
const { onReadableIdInput, resetReadableIdTouched, readableIdError } = useReadableIdFromName(form);
const idAvailability = useResourceIdAvailability(form, "campaign", () => campaign.value ?? undefined);

function openEdit() {
  if (!campaign.value) return;
  formError.value = "";
  form.readableId = campaign.value.readableId;
  form.name = campaign.value.name;
  form.isPubliclyReadable = campaign.value.isPubliclyReadable;
  form.ownerGroupId = campaign.value.ownerGroupId;
  resetReadableIdTouched(true);
  isFormOpen.value = true;
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    await $fetch(`/api/campaign/${id.value}`, {
      method: "PATCH",
      body: {
        readableId: form.readableId,
        name: form.name,
        isPubliclyReadable: form.isPubliclyReadable,
        ...(form.ownerGroupId !== (campaign.value?.ownerGroupId ?? null)
          ? { ownerGroupId: form.ownerGroupId }
          : {}),
      },
    });
    isFormOpen.value = false;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not save campaign.");
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
    await $fetch(`/api/campaign/${id.value}`, { method: "DELETE" });
    await navigateTo("/campaigns");
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
    <template v-if="campaign">
      <DetailHeader
        back-to="/campaigns"
        back-label="Back to Campaigns"
        eyebrow="Campaign"
        :title="campaign.name"
        :system-id="campaign.systemId"
        :source="campaign.source"
      >
        <template #meta>
          <ReadableIdBadge
            :readable-id="campaign.readableId"
            :owner="campaign.ownerReadableId"
          />
          <VisibilityBadge :is-publicly-readable="campaign.isPubliclyReadable" />
        </template>
        <template v-if="campaign.canEdit" #actions>
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            @click="openEdit"
          >
            Edit
          </UButton>
          <UButton
            v-if="campaign.canDelete"
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
        <!-- Placeholder until campaigns hold characters and content (the
             "Make Campaigns places to play" item in TODO.md). -->
        <DetailPanel title="In Play">
          <p class="px-[18px] py-6 text-center text-sm text-muted">
            Characters and content can't be added to campaigns yet.
          </p>
        </DetailPanel>

        <AboutPanel
          :facts="[
            { label: 'Owner', value: ownerLabel(campaign) },
            { label: 'ID', value: campaign.readableId, mono: true },
            { label: 'Visibility', value: visibilityLabel(campaign.isPubliclyReadable) },
            { label: 'System', value: system?.name },
            { label: 'Updated', value: formatShortDate(campaign.updatedAt) },
          ]"
        />
      </div>
    </template>

    <UModal v-model:open="isFormOpen" title="Edit Campaign">
      <template #body>
        <UForm
          id="campaign-detail-form"
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
          <OwnerField
            v-if="campaign?.canChangeOwner"
            v-model="form.ownerGroupId"
            :original="campaign?.ownerGroupId ?? null"
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
          form="campaign-detail-form"
          label="Save"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete Campaign"
      :description="`Are you sure you want to delete &quot;${campaign?.name}&quot;? This action cannot be undone.`"
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
