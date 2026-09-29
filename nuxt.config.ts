import { sheetFonts } from "./shared/sheet/fonts";

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

  // Fonts Sheet CSS can use (see shared/sheet/fonts.ts). `global` loads them
  // even though no app CSS mentions them.
  fonts: {
    families: sheetFonts.map(({ name }) => ({
      name,
      provider: "google",
      global: true,
    })),
  },

  scalar: {
    darkMode: true,
    metaData: {
      title: "Soul Tabletop API Documentation",
    },
    // Relative, so Scalar resolves it against the page's own origin. Nitro's
    // generated spec builds an absolute server URL from the SSR request that
    // fetched it, which lacks the real host and port.
    servers: [{ url: "/" }],
  },
});
