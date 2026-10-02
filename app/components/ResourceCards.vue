<script setup lang="ts" generic="T extends ResourceCardItem">
import type { ResourceCardItem } from "~/utils/resource-card";

// The cards view of a resource list: a grid with one card per item showing its
// name (the card's link), address (`owner/id`), Source and Visibility badges, details
// from the page (`#details`), the page's actions menu (`#actions`), and a
// footer with a summary from the page (`#summary`, e.g. a count) and the
// updated date.
defineProps<{ items: T[]; to: (item: T) => string }>();
</script>

<template>
  <ul v-if="items.length" class="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
    <li
      v-for="item in items"
      :key="item.id"
      class="relative flex flex-col gap-3 rounded-lg border border-default bg-default p-4 transition-colors focus-within:ring-2 focus-within:ring-primary hover:border-primary/40"
    >
      <div class="flex items-start justify-between gap-2">
        <h2 class="font-display min-w-0 text-[22px] leading-tight font-bold text-highlighted">
          <!-- The link covers the whole card; the menu sits above it. -->
          <NuxtLink
            :to="to(item)"
            class="break-words after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {{ item.name }}
          </NuxtLink>
        </h2>
        <div class="relative z-10 -me-2 -mt-1 shrink-0">
          <slot name="actions" :item="item" />
        </div>
      </div>

      <ReadableIdBadge
        v-if="item.readableId"
        :readable-id="item.readableId"
        :owner="item.ownerReadableId"
        class="self-start"
      />

      <div class="flex flex-wrap items-center gap-2">
        <SourceBadge v-if="item.source" :source="item.source" />
        <VisibilityBadge
          v-if="item.isPubliclyReadable !== undefined"
          :is-publicly-readable="item.isPubliclyReadable"
        />
        <slot name="badges" :item="item" />
      </div>

      <dl
        v-if="$slots.details"
        class="relative z-10 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]"
      >
        <slot name="details" :item="item" />
      </dl>

      <p
        v-if="item.updatedAt"
        class="mt-auto flex flex-wrap justify-between gap-x-3 border-t border-default pt-2.5 text-[13px] text-muted tabular-nums"
      >
        <span><slot name="summary" :item="item" /></span>
        <span>{{ formatShortDate(item.updatedAt) }}</span>
      </p>
    </li>
  </ul>
  <slot v-else name="empty" />
</template>
