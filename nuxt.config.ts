import yaml from "@rollup/plugin-yaml";
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

  // Scalar's API reference logs hydration mismatches inside its own
  // components when server-rendered, so render it in the browser only.
  routeRules: {
    "/docs": { ssr: false },
  },

  compatibilityDate: "2026-06-30",

  nitro: {
    experimental: {
      openAPI: true,
    },
    // The API reference's own heading and how to authenticate. The security
    // schemes themselves are declared in `server/api/profile/api-keys/index.get.ts`.
    openAPI: {
      meta: {
        title: "Soul Tabletop API",
        description: [
          "Requests are authenticated by the session cookie (signed in to the site) or by a user API key, created on your profile page. Send the key as `Authorization: Bearer <key>` or `x-api-key: <key>`; a session cookie, if there is one, is used instead.",
          "",
          "A key acts as the user who made it. A Read Only key gets 403 on any request that changes data (anything but GET, HEAD, and OPTIONS); a Full Access key can do anything the user can, except manage API keys, which needs a signed-in session. On any endpoint that looks up who is calling, including public ones, a key that is invalid, expired, or deleted gets 401 rather than being treated as logged out.",
        ].join("\n"),
      },
    },
  },

  // Lets `content/copy.yml` be imported.
  vite: {
    plugins: [yaml()],
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
    authentication: { preferredSecurityScheme: "bearerAuth" },
  },
});
