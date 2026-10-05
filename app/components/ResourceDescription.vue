<script setup lang="ts">
import { extractApiErrorMessage } from "~/utils/api-error";

// A resource's Markdown description as a detail page panel. People who can
// edit the resource edit it in place with the Markdown editor; for everyone
// else the panel is hidden while there's no description.
const props = defineProps<{
  description: string | null | undefined;
  canEdit: boolean;
  // Saves the new description (null for none); errors are shown in the panel.
  save: (description: string | null) => Promise<void>;
  // The resource kind in lowercase, for messages ("system").
  kind: string;
}>();

const editing = ref(false);
const draft = ref("");
const busy = ref(false);
const error = ref("");

function startEdit() {
  draft.value = props.description ?? "";
  error.value = "";
  editing.value = true;
}

async function submit() {
  busy.value = true;
  error.value = "";
  try {
    await props.save(draft.value.trim() ? draft.value : null);
    editing.value = false;
  } catch (caught) {
    error.value = extractApiErrorMessage(caught, `Could not save ${props.kind} description.`);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <DetailPanel v-if="description || canEdit" title="Description">
    <template v-if="canEdit && !editing" #actions>
      <UButton
        :icon="description ? 'i-lucide-pencil' : 'i-lucide-plus'"
        color="neutral"
        variant="outline"
        @click="startEdit"
      >
        {{ description ? "Edit Description" : "Add Description" }}
      </UButton>
    </template>

    <div v-if="editing" class="space-y-3 px-[18px] py-4">
      <div class="rounded-md border border-default px-3 py-2">
        <UEditor
          v-model="draft"
          content-type="markdown"
          :image="false"
          :mention="false"
        :ui="{ base: 'sm:px-0' }"
          placeholder="Write a description…"
          aria-label="Description"
        />
      </div>
      <UAlert v-if="error" color="error" variant="subtle" :description="error" />
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          :disabled="busy"
          @click="editing = false"
        />
        <UButton label="Save" :loading="busy" @click="submit" />
      </div>
    </div>
    <div v-else-if="description" class="px-[18px] py-4">
      <UEditor
        :model-value="description"
        content-type="markdown"
        :editable="false"
        :image="false"
        :mention="false"
        :ui="{ base: 'sm:px-0' }"
      />
    </div>
    <p v-else class="px-[18px] py-6 text-center text-sm text-muted">
      No description yet.
    </p>
  </DetailPanel>
</template>
