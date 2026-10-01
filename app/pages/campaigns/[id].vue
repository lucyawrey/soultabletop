<script setup lang="ts">
import { extractApiErrorMessage } from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

interface CampaignDetail {
  id: string;
  readableId: string;
  ownerReadableId: string | null;
  name: string;
  isPubliclyReadable: boolean;
  updatedAt: string;
  systemId?: string;
  canEdit: boolean;
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

const { data: systems, status: systemsStatus } = await useLazyFetch<SystemOption[]>("/api/system", {
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
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <UButton
      to="/campaigns"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      size="sm"
    >
      Back to Campaigns
    </UButton>

    <template v-if="campaign">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-highlighted">{{ campaign.name }}</h1>
          <p class="text-sm text-muted">
            {{ campaign.readableId }} ·
            {{ visibilityLabel(campaign.isPubliclyReadable) }}
          </p>
          <p v-if="system || isLoading(systemsStatus)" class="mt-1 text-sm">
            System:
            <LookupSkeleton v-if="!system" />
            <NuxtLink
              v-else
              :to="`/systems/${system.id}`"
              class="text-primary hover:underline"
            >
              {{ system.name }}
            </NuxtLink>
          </p>
        </div>
        <div v-if="campaign?.canEdit" class="flex gap-2">
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
            :error="readableIdError"
            @update:model-value="onReadableIdInput"
          />
          <VisibilityField v-model="form.isPubliclyReadable" />
          <OwnerField
            v-if="campaign?.canChangeOwner"
            v-model="form.ownerGroupId"
            :original="campaign?.ownerGroupId ?? null"
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
  </div>
</template>
