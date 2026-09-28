<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

const props = defineProps<{ node: ValidatedElement }>();

const attrText = useSheetAttrText();
// Only valid <Tab> children; the validator reports anything else.
const tabs = computed(() =>
  props.node.children.filter(
    (child): child is ValidatedElement =>
      child.type === "element" && child.tag === "Tab",
  ),
);
const items = computed(() =>
  tabs.value.map((tab, index) => ({
    label: attrText(tab.attrs.label),
    icon: tab.attrs.icon as string | undefined,
    value: String(index),
  })),
);
</script>

<template>
  <UTabs :items="items" :class="sheetClasses(node)" :unmount-on-hide="false">
    <template #content="{ item }">
      <div
        v-if="tabs[Number(item.value)]"
        :class="[sheetClasses(tabs[Number(item.value)]!), 'space-y-4 pt-2']"
      >
        <SheetNodes :nodes="tabs[Number(item.value)]!.children" />
      </div>
    </template>
  </UTabs>
</template>
