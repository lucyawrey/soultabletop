// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui", "@scalar/nuxt"],

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL ?? "",
    betterAuthSecret: process.env.BETTER_AUTH_SECRET ?? "",
  },

  routeRules: {
    "/": { prerender: true },
  },

  compatibilityDate: "2026-06-30",

  nitro: {
    experimental: {
      openAPI: true,
    },
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: "never",
        braceStyle: "1tbs",
      },
    },
  },

  scalar: {
    darkMode: true,
    metaData: {
      title: "Soul Tabletop API Documentation",
    },
    servers: [
      {
        url: process.env.BASE_URL,
      },
    ],
  },
});
