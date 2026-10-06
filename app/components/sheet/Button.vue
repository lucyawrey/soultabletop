<script setup lang="ts">
import { sheetButtonWrites, sheetValueAt } from "#shared/sheet/runtime";
import type { ValidatedElement } from "#shared/sheet/validate";

// <Button>: clicking it writes its <Set>s' values (see sheetButtonWrites),
// then a toast offers Undo. Shown only to viewers who can edit the Content;
// with Edit off it's disabled unless `live`. With `amount`, it reads the
// number box of its SheetButtonGroup. (Not disabled while the box is empty:
// the box only takes what's typed when it loses focus, which clicking the
// button does.)
const props = defineProps<{ node: ValidatedElement; compact?: boolean }>();

const { context, scope } = useSheet();
const attrText = useSheetAttrText();
const flags = useSheetFlags();
const compactSheet = useSheetCompact();
const amount = useSheetButtonAmount();
const toast = useToast();

const label = computed(() => attrText(props.node.attrs.label));
const icon = computed(() => props.node.attrs.icon as string | undefined);
const usesAmount = computed(() => props.node.attrs.amount === true);
const disabled = computed(() => !sheetButtonUsable(context, flags.value, props.node));

function click() {
  const result = sheetButtonWrites(
    props.node,
    context.root.value,
    scope.value,
    context.refs.value,
    context.formulas.value,
    usesAmount.value ? amount.value : undefined,
  );
  if ("error" in result) {
    toast.add({
      title: `${label.value} didn't change anything`,
      description: result.error,
      color: "error",
      icon: "i-lucide-triangle-alert",
    });
    return;
  }
  const { writes } = result;
  for (const write of writes) context.update(write.path, write.value);
  if (usesAmount.value) amount.value = null;
  toast.add({
    title: label.value,
    icon: icon.value,
    ...(writes.length
      ? {
          actions: [
            {
              label: "Undo",
              color: "neutral",
              variant: "outline",
              // Last write first, so a field written twice gets its first
              // value back. A value changed since (edited, or its row moved)
              // is left as it is.
              onClick: () => {
                let skipped = 0;
                const written = new Map(writes.map((write) => [JSON.stringify(write.path), write.value]));
                for (const write of [...writes].reverse()) {
                  const key = JSON.stringify(write.path);
                  if (sheetValueAt(context.root.value.value, write.path) !== written.get(key)) {
                    skipped += 1;
                    continue;
                  }
                  context.update(write.path, write.previous);
                  written.set(key, write.previous);
                }
                if (skipped) {
                  toast.add({
                    title: `Undo left ${skipped === 1 ? "1 value" : `${skipped} values`} as they are`,
                    description: "They changed after the click.",
                    color: "warning",
                  });
                }
              },
            },
          ],
        }
      : { description: "Nothing to change." }),
  });
}
</script>

<template>
  <UButton
    v-if="context.canEdit.value"
    :class="sheetClasses(node)"
    :label="label"
    :icon="icon"
    color="neutral"
    variant="outline"
    :size="compactSheet ? 'xs' : 'sm'"
    :disabled="disabled"
    @click="click"
  />
</template>
