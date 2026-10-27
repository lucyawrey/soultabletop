<script setup lang="ts">
import type { ResourceSource } from "#shared/resource-list";
import type { SheetLinks, SheetRef, SheetRefs } from "#shared/sheet/runtime";
import { extractApiErrorMessage } from "~/utils/api-error";
import type { ResourceOptionItem } from "~/utils/resource-option";

// Searchable choice of existing Content of one ContentType, loaded each
// time it opens. Emits the picked Content so it can be shown before saving.
const props = defineProps<{
  contentTypeId: string;
  modelValue?: string;
  // The current value's name, shown until the list loads (the options are only
  // fetched when the picker opens).
  currentName?: string;
  placeholder?: string;
  // A Ref's filter: the top-level fields it reads, loaded with the list, and
  // whether a candidate (those fields plus `name`) is offered.
  dataKeys?: string[];
  accepts?: (data: Record<string, unknown>) => boolean;
  // When set, the first option, which emits `custom` instead of a pick.
  customLabel?: string;
  // A custom entry's name (undefined for a reference), typed in place of the
  // picked name, so a custom entry looks like a picked one.
  customName?: string;
  // The field's label, for the name input.
  label?: string;
}>();
const emit = defineEmits<{
  pick: [id: string, ref: SheetRef];
  custom: [];
  "update:customName": [name: string];
}>();
const isCustom = computed(() => props.customName !== undefined);

// Not a UUID, so it can't collide with a content ID.
const customValue = "custom";

interface ContentListItem {
  id: string;
  name: string;
  contentTypeId: string;
  source: ResourceSource;
  data?: Record<string, unknown>;
}

const options = ref<ContentListItem[]>([]);
const loading = ref(false);

async function load(open: boolean) {
  // Loads on every open, so content created since the last open shows up.
  if (!open || loading.value) return;
  loading.value = true;
  try {
    const list = await $fetch<ContentListItem[]>("/api/content", {
      query: {
        contentTypeId: props.contentTypeId,
        ...(props.dataKeys?.length ? { dataKeys: props.dataKeys.join(",") } : {}),
      },
    });
    const accepts = props.accepts;
    options.value = accepts
      ? list.filter((item) => accepts({ ...item.data, name: item.name }))
      : list;
  } finally {
    loading.value = false;
  }
}

const items = computed(() => {
  const list = options.value.map((item) =>
    resourceOption(item.id, {
      name: item.name,
      source: item.source,
    }),
  );
  // Without an item for the current value the menu would show its raw ID.
  if (
    props.modelValue &&
    props.currentName &&
    !list.some((item) => item.value === props.modelValue)
  )
    list.unshift(resourceOption(props.modelValue, { name: props.currentName }));
  if (props.customLabel || isCustom.value) {
    const label = props.customLabel ?? "Custom";
    list.unshift({ label, value: customValue, name: label });
  }
  return list;
});

// The list leaves out each content's data, so the picked one's is loaded here.
const toast = useToast();
const { context } = useSheet();

// The name input sits over the trigger's value, which holds the same text
// (hidden) so the trigger keeps the size and spot of a picked name. It copies
// the value's font and the trigger's color and underline, which the sheet's
// CSS may have changed.
const wrapper = ref<HTMLElement>();
const nameStyle = ref<Record<string, string>>({});
function placeName() {
  const value = wrapper.value?.querySelector<HTMLElement>("[data-slot=value]");
  const trigger = value?.closest<HTMLElement>("[data-slot=base]");
  if (!value || !trigger || !wrapper.value) return;
  const box = wrapper.value.getBoundingClientRect();
  const spot = value.getBoundingClientRect();
  const font = getComputedStyle(value);
  const look = getComputedStyle(trigger);
  nameStyle.value = {
    marginLeft: `${spot.left - box.left}px`,
    marginTop: `${spot.top - box.top}px`,
    width: `${spot.width}px`,
    height: `${spot.height}px`,
    font: font.font,
    letterSpacing: font.letterSpacing,
    color: look.color,
    textDecorationLine: look.textDecorationLine,
    textDecorationColor: look.textDecorationColor,
    textUnderlineOffset: look.textUnderlineOffset,
  };
}
let resizeObserver: ResizeObserver | undefined;
watch(
  [isCustom, wrapper],
  async ([custom]) => {
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    if (!custom || !wrapper.value) return;
    await nextTick();
    const value = wrapper.value?.querySelector("[data-slot=value]");
    if (!value) return;
    resizeObserver = new ResizeObserver(placeName);
    resizeObserver.observe(value);
    placeName();
  },
  { flush: "post" },
);
onBeforeUnmount(() => resizeObserver?.disconnect());

// The picker is disabled while that request runs, so picks can't overlap or
// arrive out of order.
const picking = ref(false);
async function select(id: unknown) {
  if (id === customValue) {
    if (!isCustom.value) emit("custom");
    return;
  }
  const item = options.value.find((option) => option.id === id);
  if (!item || picking.value) return;
  picking.value = true;
  try {
    const { data, refs, links } = await $fetch<{
      data: Record<string, unknown>;
      refs?: SheetRefs;
      links?: SheetLinks;
    }>(`/api/content/${item.id}`);
    // What the picked content references (a class's features) loads with it,
    // so the sheet can show it before the next save reloads refs.
    for (const [refId, ref] of Object.entries(refs ?? {})) context.addRef(refId, ref);
    for (const [linkId, link] of Object.entries(links ?? {})) context.addLink(linkId, link);
    emit("pick", item.id, {
      name: item.name,
      contentTypeId: item.contentTypeId,
      data,
    });
  } catch (error) {
    toast.add({
      title: extractApiErrorMessage(error, "Could not load content."),
      color: "error",
    });
  } finally {
    picking.value = false;
  }
}
</script>

<template>
  <!-- A grid, not positioned, so a sheet can still place the trigger's parts
    against its own boxes. -->
  <div ref="wrapper" class="sheet-content-picker grid justify-items-start">
  <USelectMenu
    :content="{ align: 'start' }"
    :model-value="isCustom ? customValue : modelValue"
    :items="items"
    value-key="value"
    :loading="loading || picking"
    :disabled="picking"
    :placeholder="placeholder ?? 'Choose…'"
    class="col-start-1 row-start-1 w-full"
    @update:open="load"
    @update:model-value="select"
  >
    <template v-if="isCustom" #default="{ ui }">
      <span data-slot="value" :class="ui.value()" class="invisible whitespace-pre">{{ customName || "Name" }}</span>
    </template>
    <template #item-label="{ item }">
      <ResourceOption :option="item as ResourceOptionItem" />
    </template>
  </USelectMenu>
  <input
    v-if="isCustom"
    :value="customName"
    placeholder="Name"
    :aria-label="`${label ?? 'Custom'} name`"
    class="sheet-custom-name relative z-10 col-start-1 row-start-1 min-w-0 self-start border-0 bg-transparent p-0 outline-none placeholder:text-dimmed focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
    :style="nameStyle"
    @input="emit('update:customName', ($event.target as HTMLInputElement).value)"
  >
  </div>
</template>
