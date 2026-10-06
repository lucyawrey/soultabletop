<script setup lang="ts">
import type { ValidatedElement } from "#shared/sheet/validate";

const props = defineProps<{ node: ValidatedElement }>();

const attrText = useSheetAttrText();
const title = computed(() => attrText(props.node.attrs.title));
const subtitle = computed(() => attrText(props.node.attrs.subtitle));
const compact = useSheetCompact();
</script>

<template>
  <UCollapsible
    :default-open="node.attrs.open === true"
    :class="[sheetClasses(node), 'rounded-md border border-default']"
  >
    <template #default="{ open }">
      <button
        type="button"
        class="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <UIcon
          v-if="node.attrs.icon"
          :name="node.attrs.icon as string"
          class="size-4 text-primary"
        />
        <span class="font-medium text-highlighted">{{ title }}</span>
        <span v-if="subtitle" class="text-sm text-muted">{{ subtitle }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="ms-auto size-4 text-muted transition-transform"
          :class="open ? 'rotate-180' : ''"
        />
      </button>
    </template>
    <template #content>
      <div class="border-t border-default" :class="compact ? 'space-y-2 p-2' : 'space-y-4 p-3'">
        <SheetNodes :nodes="node.children" />
      </div>
    </template>
  </UCollapsible>
</template>
