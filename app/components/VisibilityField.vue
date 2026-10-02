<script setup lang="ts">
// Form field for a Resource's `isPubliclyReadable` flag, shown as Visibility.
const isPubliclyReadable = defineModel<boolean>({ required: true });

const items = [
  {
    label: visibilityLabel(true),
    value: "public",
    description: "Anyone can view it.",
  },
  {
    label: visibilityLabel(false),
    value: "limited",
    description: "Only owners and people it's shared with can view it.",
  },
];

// Radio values can't be booleans, so map to/from string keys.
const selected = computed({
  get: () => (isPubliclyReadable.value ? "public" : "limited"),
  set: (value: string) => {
    isPubliclyReadable.value = value === "public";
  },
});
</script>

<template>
  <UFormField name="isPubliclyReadable" label="Visibility">
    <URadioGroup
      v-model="selected"
      :items="items"
      variant="card"
      orientation="horizontal"
      indicator="start"
      :ui="{
        fieldset: 'grid w-full gap-2 sm:grid-cols-2',
        // The mockup's cards: the page tone with a strong border, and the
        // chosen one a panel outlined in primary.
        item: 'rounded-lg border-accented bg-(--st-page) px-3 py-2.5 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-default has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary',
        label: 'font-bold',
        description: 'text-[13px]',
      }"
    />
  </UFormField>
</template>
