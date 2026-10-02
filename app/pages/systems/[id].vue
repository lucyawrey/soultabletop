<script setup lang="ts">
import {
  CONTENT_CATEGORY_LABELS,
  type ContentCategory,
} from "#shared/content-categories";
import { extractApiErrorMessage } from "~/utils/api-error";

interface SystemDetail {
  id: string;
  readableId: string;
  ownerReadableId: string | null;
  name: string;
  isPubliclyReadable: boolean;
  updatedAt: string;
  canEdit: boolean;
  ownerGroupId: string | null;
  canChangeOwner: boolean;
}

interface ContentTypeOption {
  id: string;
  name: string;
  readableId: string;
  systemId: string;
  contentCategory: ContentCategory;
}

const route = useRoute();

const { followSystem } = useCurrentSystem();
const { data: system, refresh } = await useResourceFetch<SystemDetail>("/api/system");
useReadableAddress("systems", system);
// The route may address the system by owner + readable ID; changes go by ID.
const id = computed(() => system.value?.id ?? "");
followSystem(system.value?.id);

// Logged-out visitors can view this if it's public; otherwise they're sent to
// sign in, since it may be something their account can see.
const loggedIn = await useLoggedIn();
if (!system.value && !loggedIn.value) {
  await navigateTo(signInRoute(route.fullPath), { replace: true });
}

const { data: contentTypes, status: contentTypesStatus } = await useLazyFetch<ContentTypeOption[]>(
  "/api/content-type",
  { default: () => [] },
);

const systemContentTypes = computed(() =>
  contentTypes.value.filter((type) => type.systemId === id.value),
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
const idAvailability = useResourceIdAvailability(form, "system", () => system.value ?? undefined);

function openEdit() {
  if (!system.value) return;
  formError.value = "";
  form.readableId = system.value.readableId;
  form.name = system.value.name;
  form.isPubliclyReadable = system.value.isPubliclyReadable;
  form.ownerGroupId = system.value.ownerGroupId;
  resetReadableIdTouched(true);
  isFormOpen.value = true;
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    await $fetch(`/api/system/${id.value}`, {
      method: "PATCH",
      body: {
        readableId: form.readableId,
        name: form.name,
        isPubliclyReadable: form.isPubliclyReadable,
        ...(form.ownerGroupId !== (system.value?.ownerGroupId ?? null)
          ? { ownerGroupId: form.ownerGroupId }
          : {}),
      },
    });
    isFormOpen.value = false;
    await Promise.all([refresh(), refreshSystems()]);
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not save system.");
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
    await $fetch(`/api/system/${id.value}`, { method: "DELETE" });
    await refreshSystems();
    await navigateTo("/systems");
  } catch (error) {
    deleteError.value = extractApiErrorMessage(
      error,
      "Could not delete system.",
    );
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <template v-if="system">
      <DetailHeader
        back-to="/systems"
        back-label="Back to Systems"
        eyebrow="System"
        :title="system.name"
      >
        <template #meta>
          <ReadableIdBadge
            :readable-id="system.readableId"
            :owner="system.ownerReadableId"
          />
          <VisibilityBadge :is-publicly-readable="system.isPubliclyReadable" />
        </template>
        <template v-if="system.canEdit" #actions>
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

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <DetailPanel title="Content Types">
          <template v-if="loggedIn" #actions>
            <UButton
              :to="{ path: '/types', query: { systemId: id } }"
              icon="i-lucide-plus"
            >
              New Content Type
            </UButton>
          </template>

          <ul
            v-if="systemContentTypes.length"
            class="divide-y divide-default"
          >
            <li
              v-for="type in systemContentTypes"
              :key="type.id"
              class="flex flex-wrap items-center justify-between gap-3 px-[18px] py-3"
            >
              <span class="flex items-center gap-2.5">
                <UIcon
                  :name="CONTENT_CATEGORY_ICONS[type.contentCategory]"
                  class="size-[17px] shrink-0 text-secondary"
                />
                <NuxtLink
                  :to="`/types/${type.id}`"
                  class="font-bold text-highlighted hover:text-primary hover:underline"
                >
                  {{ type.name }}
                </NuxtLink>
              </span>
              <LabelChip>
                {{ CONTENT_CATEGORY_LABELS[type.contentCategory] }}
              </LabelChip>
            </li>
          </ul>
          <TableSkeleton
            v-else-if="isLoading(contentTypesStatus)"
            :rows="2"
            class="px-[18px]"
          />
          <p v-else class="px-[18px] py-6 text-center text-sm text-muted">
            No content types for this system yet.
          </p>
        </DetailPanel>

        <AboutPanel
          :facts="[
            { label: 'Owner', value: ownerLabel(system) },
            { label: 'ID', value: system.readableId, mono: true },
            { label: 'Visibility', value: visibilityLabel(system.isPubliclyReadable) },
            { label: 'Content types', value: isLoading(contentTypesStatus) ? null : systemContentTypes.length },
            { label: 'Updated', value: formatShortDate(system.updatedAt) },
          ]"
        />
      </div>
    </template>

    <UModal v-model:open="isFormOpen" title="Edit System">
      <template #body>
        <UForm
          id="system-detail-form"
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
          <VisibilityField v-model="form.isPubliclyReadable" />
          <OwnerField
            v-if="system?.canChangeOwner"
            v-model="form.ownerGroupId"
            :original="system?.ownerGroupId ?? null"
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
          form="system-detail-form"
          label="Save"
          :loading="formBusy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Delete System"
      :description="`Are you sure you want to delete &quot;${system?.name}&quot;? This action cannot be undone.`"
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
