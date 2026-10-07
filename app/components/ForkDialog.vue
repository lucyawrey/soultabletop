<script setup lang="ts">
import { resourceLinkPath } from "#shared/sheet/runtime";

// "Fork": copy a system, content type, or sheet into the user's account (or a
// group's), optionally with its parents by the same owner (sheet → content
// type → system) and that owner's other resources below the topmost copy
// (`server/utils/resource-fork.ts`). Opens the copy's page when done.
type ForkKind = "system" | "contentType" | "sheet";
interface ForkCandidate {
  id: string;
  kind: ForkKind;
  name: string;
  readableId: string;
  parentId: string | null;
}
interface ForkOptions {
  resource: ForkCandidate;
  parents: ForkCandidate[];
  extras: ForkCandidate[];
}

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ resourceId: string }>();

const KIND_LABELS: Record<ForkKind, string> = {
  system: "System",
  contentType: "Content Type",
  sheet: "Sheet",
};

const options = ref<ForkOptions | null>(null);
const loadError = ref("");
const owner = ref<string | null>(null);
const withParents = ref(true);
const included = ref(new Set<string>());
const busy = ref(false);
const error = ref("");

watch(open, async (isOpen) => {
  if (!isOpen) return;
  options.value = null;
  loadError.value = "";
  error.value = "";
  withParents.value = true;
  try {
    const result = await $fetch<ForkOptions>(`/api/resource/${props.resourceId}/fork`);
    options.value = result;
    included.value = new Set(result.extras.map((extra) => extra.id));
  } catch (caught) {
    loadError.value = extractApiErrorMessage(caught, "Could not load what to copy.");
  }
});

// The extras that can be copied with the current choices: those whose parent
// is copied (extras list content types before their sheets).
const availableExtras = computed(() => {
  if (!options.value) return [];
  const copied = new Set([
    options.value.resource.id,
    ...(withParents.value ? options.value.parents.map((parent) => parent.id) : []),
  ]);
  return options.value.extras.filter((extra) => {
    if (!extra.parentId || !copied.has(extra.parentId)) return false;
    if (included.value.has(extra.id)) copied.add(extra.id);
    return true;
  });
});

function setIncluded(id: string, value: boolean | "indeterminate") {
  const next = new Set(included.value);
  if (value === true) next.add(id);
  else next.delete(id);
  included.value = next;
}

const parentsLabel = computed(() =>
  (options.value?.parents ?? [])
    .map((parent) => `${KIND_LABELS[parent.kind].toLowerCase()} (${parent.name})`)
    .join(" and "),
);

async function submit() {
  if (!options.value) return;
  busy.value = true;
  error.value = "";
  try {
    const { copies } = await $fetch<{ copies: { id: string; kind: ForkKind; forkedFromId: string }[] }>(
      `/api/resource/${props.resourceId}/fork`,
      {
        method: "POST",
        body: {
          ownerGroupId: owner.value,
          withParents: withParents.value,
          include: availableExtras.value
            .filter((extra) => included.value.has(extra.id))
            .map((extra) => extra.id),
        },
      },
    );
    const copy = copies.find((item) => item.forkedFromId === props.resourceId)!;
    if (copies.some((item) => item.kind === "system")) await refreshSystems();
    open.value = false;
    await navigateTo(resourceLinkPath(copy.id, { name: "", kind: copy.kind }));
  } catch (caught) {
    error.value = extractApiErrorMessage(caught, "Could not fork.");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="options ? `Fork ${KIND_LABELS[options.resource.kind]}` : 'Fork'"
    description="Copy it into your own account. Copies start Limited and remember where they came from."
  >
    <template #body>
      <UAlert v-if="loadError" color="error" variant="subtle" :description="loadError" />
      <div v-else-if="!options" class="flex justify-center py-6">
        <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" />
      </div>
      <UForm v-else id="fork-form" :state="{}" class="space-y-4" @submit="submit">
        <OwnerField v-model="owner" />
        <UCheckbox
          v-if="options.parents.length > 0"
          v-model="withParents"
          :label="`Also copy its ${parentsLabel}`"
          description="The copy then uses the copied parents. Otherwise it stays on the originals."
        />
        <UFormField
          v-if="availableExtras.length > 0"
          label="Also copy"
          help="References between copies point at the copies."
        >
          <div class="space-y-2 pt-1">
            <UCheckbox
              v-for="extra in availableExtras"
              :key="extra.id"
              :id="`fork-extra-${extra.id}`"
              :model-value="included.has(extra.id)"
              :label="extra.name"
              :description="KIND_LABELS[extra.kind]"
              @update:model-value="setIncluded(extra.id, $event)"
            />
          </div>
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
      </UForm>
    </template>

    <template #footer="{ close }">
      <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
      <UButton
        type="submit"
        form="fork-form"
        label="Fork"
        icon="i-lucide-git-fork"
        :loading="busy"
        :disabled="!options"
      />
    </template>
  </UModal>
</template>
