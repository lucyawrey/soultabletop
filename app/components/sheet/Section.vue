<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

const props = defineProps<{ node: ValidatedElement }>();

const attrText = useSheetAttrText();
const title = computed(() => attrText(props.node.attrs.title));
const description = computed(() => attrText(props.node.attrs.description));
const icon = computed(() => props.node.attrs.icon as string | undefined);
const collapsible = computed(
  () => props.node.attrs.collapsible === true || props.node.attrs.collapsed === true,
);
const open = ref(props.node.attrs.collapsed !== true);
const span = computed(() => {
  const value = props.node.attrs.span;
  return typeof value === "number" ? sheetColSpan[value] : undefined;
});
const hasHeader = computed(
  () => !!(title.value || description.value || icon.value || collapsible.value),
);
</script>

<template>
  <UCard
    :class="[sheetClasses(node), span]"
    :ui="{ body: open ? undefined : 'hidden' }"
  >
    <template v-if="hasHeader" #header>
      <component
        :is="collapsible ? 'button' : 'div'"
        :type="collapsible ? 'button' : undefined"
        class="flex w-full items-start gap-2 text-left"
        :aria-expanded="collapsible ? open : undefined"
        @click="collapsible && (open = !open)"
      >
        <UIcon v-if="icon" :name="icon" class="mt-0.5 size-5 text-primary" />
        <div class="min-w-0 flex-1">
          <h3 v-if="title" class="font-semibold text-highlighted">{{ title }}</h3>
          <p v-if="description" class="text-sm text-muted">{{ description }}</p>
        </div>
        <UIcon
          v-if="collapsible"
          name="i-lucide-chevron-down"
          class="mt-0.5 size-5 text-muted transition-transform"
          :class="open ? 'rotate-180' : ''"
        />
      </component>
    </template>
    <div v-if="open" class="space-y-4">
      <SheetNodes :nodes="node.children" />
    </div>
  </UCard>
</template>
