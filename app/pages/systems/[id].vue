<script setup lang="ts">
import { extractApiErrorMessage } from "~/utils/api-error";

definePageMeta({ middleware: "auth" });

interface SystemDetail {
  id: string;
  slug: string;
  name: string;
  isPubliclyReadable: boolean;
  updatedAt: string;
}

interface ContentTypeOption {
  id: string;
  name: string;
  slug: string;
  systemId: string;
}

const route = useRoute();
const id = route.params.id as string;

const { data: system, refresh } = await useFetch<SystemDetail>(
  `/api/system/${id}`,
);

const { data: contentTypes } = await useLazyFetch<ContentTypeOption[]>(
  "/api/content-type",
  { default: () => [] },
);

const systemContentTypes = computed(() =>
  contentTypes.value.filter((type) => type.systemId === id),
);

const isFormOpen = ref(false);
const form = reactive({ slug: "", name: "", isPubliclyReadable: false });
const formBusy = ref(false);
const formError = ref("");
const { onSlugInput, resetSlugTouched, slugError } = useSlugFromName(form);

function openEdit() {
  if (!system.value) return;
  formError.value = "";
  form.slug = system.value.slug;
  form.name = system.value.name;
  form.isPubliclyReadable = system.value.isPubliclyReadable;
  resetSlugTouched(true);
  isFormOpen.value = true;
}

async function submitForm() {
  formBusy.value = true;
  formError.value = "";

  try {
    await $fetch(`/api/system/${id}`, {
      method: "PATCH",
      body: {
        slug: form.slug,
        name: form.name,
        isPubliclyReadable: form.isPubliclyReadable,
      },
    });
    isFormOpen.value = false;
    await refresh();
  } catch (error) {
    formError.value = extractApiErrorMessage(error, "Could not save System.");
  } finally {
    formBusy.value = false;
  }
}

const isDeleteOpen = ref(false);
const deleteBusy = ref(false);

async function remove() {
  deleteBusy.value = true;

  try {
    await $fetch(`/api/system/${id}`, { method: "DELETE" });
    await navigateTo("/systems");
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-(--ui-container) space-y-6 p-4 py-8">
    <UButton
      to="/systems"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      size="sm"
    >
      Back to Systems
    </UButton>

    <template v-if="system">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-highlighted">
            {{ system.name }}
          </h1>
          <p class="text-sm text-muted">
            {{ system.slug }} ·
            {{ system.isPubliclyReadable ? "Public" : "Private" }}
          </p>
        </div>
        <div class="flex gap-2">
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
            @click="isDeleteOpen = true"
          >
            Delete
          </UButton>
        </div>
      </div>

      <UPageCard>
        <template #header>
          <h2 class="text-lg font-semibold text-highlighted">
            Content Types
          </h2>
        </template>

        <ul
          v-if="systemContentTypes.length"
          class="divide-y divide-default"
        >
          <li
            v-for="type in systemContentTypes"
            :key="type.id"
            class="flex items-center justify-between py-2"
          >
            <span>{{ type.name }}</span>
            <span class="text-sm text-muted">{{ type.slug }}</span>
          </li>
        </ul>
        <p v-else class="py-6 text-center text-sm text-muted">
          No Content Types for this System yet.
        </p>
      </UPageCard>
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
