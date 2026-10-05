<script setup lang="ts">
// Credits and licenses for assets bundled with the site, linked from the
// sidebar's footer. Game content is credited on its system's page.
const iconSets = [
  {
    name: "game-icons.net",
    credit: "Icons by Lorc, Delapouite & contributors",
    url: "https://game-icons.net/",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    use: "Icons in sheets (i-game-icons-…)",
  },
  {
    name: "Lucide",
    credit: "Lucide contributors",
    url: "https://lucide.dev/",
    license: "ISC",
    licenseUrl: "https://lucide.dev/license",
    use: "Site icons, and icons in sheets (i-lucide-…)",
  },
];
</script>

<template>
  <PageContainer>
    <PageHeader title="Credits" />
    <DetailPanel title="Icons">
      <ul class="divide-y divide-default">
        <li v-for="set in iconSets" :key="set.name" class="space-y-0.5 px-[18px] py-3 text-sm">
          <p class="font-semibold text-highlighted">
            <ULink :to="set.url" target="_blank" class="underline">{{ set.name }}</ULink>
          </p>
          <p class="text-default">
            {{ set.credit }}, licensed under
            <ULink :to="set.licenseUrl" target="_blank" class="underline">{{ set.license }}</ULink>.
          </p>
          <p class="text-muted">{{ set.use }}</p>
        </li>
      </ul>
    </DetailPanel>
  </PageContainer>
</template>
