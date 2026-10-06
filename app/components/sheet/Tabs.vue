<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

const props = defineProps<{ node: ValidatedElement }>();

const attrText = useSheetAttrText();
const { context, condition } = useSheet();
const compact = useSheetCompact();
// Only valid <Tab> children; the validator reports anything else. Tabs hidden
// by `show` leave the tab list.
const allTabs = computed(() =>
  props.node.children.filter(
    (child): child is ValidatedElement =>
      child.type === "element" && child.tag === "Tab",
  ),
);
const tabs = computed(() =>
  allTabs.value.flatMap((tab, index) => {
    const { shown, error } = condition(tab.attrs.show);
    return shown ? [{ tab, key: String(index), error }] : [];
  }),
);
const items = computed(() =>
  tabs.value.map(({ tab, key }) => ({
    label: attrText(tab.attrs.label),
    icon: tab.attrs.icon as string | undefined,
    value: key,
  })),
);
// The selected tab; when it gets hidden, the first visible one.
const selected = ref<string>();
const active = computed({
  get: () =>
    tabs.value.some(({ key }) => key === selected.value)
      ? selected.value
      : tabs.value[0]?.key,
  set: (value) => {
    selected.value = value;
  },
});
const tabFor = (key: string | number | undefined) =>
  tabs.value.find((item) => item.key === String(key));
</script>

<template>
  <UTabs
    v-if="items.length"
    v-model="active"
    :items="items"
    :size="compact ? 'xs' : undefined"
    :class="sheetClasses(node)"
    :unmount-on-hide="false"
  >
    <template #content="{ item }">
      <div
        v-if="tabFor(item.value)"
        :class="[sheetClasses(tabFor(item.value)!.tab), compact ? 'space-y-2 pt-1' : 'space-y-4 pt-2']"
      >
        <SheetFormulaWarning
          v-if="tabFor(item.value)!.error && context.showInvalid.value"
          :message="`show: ${tabFor(item.value)!.error}`"
        />
        <SheetNodes :nodes="tabFor(item.value)!.tab.children" />
      </div>
    </template>
  </UTabs>
</template>
