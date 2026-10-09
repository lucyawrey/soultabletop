import yaml from "@rollup/plugin-yaml";
import type { NuxtPage } from "nuxt/schema";
import { siteFonts } from "./shared/fonts";
import { RESOURCE_PAGE_SECTIONS } from "./shared/resource-address";

// Every resource detail page also answers at its owner + readable ID address
// (`shared/resource-address.ts`): the same page file under a second route,
// e.g. `/sheets/:owner()/:readableId()` beside `/sheets/:id()` and
// `/sheets/:owner()/:readableId()/edit` beside `/sheets/:id()/edit`.
function addReadableResourceRoutes(pages: NuxtPage[]) {
  const sections = Object.keys(RESOURCE_PAGE_SECTIONS).join("|");
  const idRoute = new RegExp(`^/(${sections})/:id\\(\\)(/.*)?$`);
  for (const page of [...pages]) {
    const match = page.path.match(idRoute);
    if (!match || !page.name) continue;
    pages.push({
      ...page,
      name: `${page.name}-readable`,
      path: `/${match[1]}/:owner()/:readableId()${match[2] ?? ""}`,
    });
  }
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui", "@scalar/nuxt"],

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  // One light theme, no dark mode (see docs/theme.md).
  ui: {
    colorMode: false,
    // `tertiary` is ours (steel, the contrast color); the rest are Nuxt UI's.
    theme: { colors: ["primary", "secondary", "tertiary", "info", "success", "warning", "error"] },
  },

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
          "",
          "Single-resource routes take the resource's ID or its owner and readable ID, e.g. `/api/sheet/{id}` or `/api/sheet/{owner}/{readableId}` (listed as `/api/sheet/{id}/{readableId}`, with the owner in `id`). The owner is a username or a group readable ID; both parts are case-insensitive. Addressed that way, a resource you can't read answers like one that doesn't exist (404), whatever the method.",
        ].join("\n"),
      },
    },
  },

  // Lets `content/copy.yml` be imported.
  vite: {
    plugins: [yaml()],
  },

  hooks: {
    "pages:extend": addReadableResourceRoutes,
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: "never",
        braceStyle: "1tbs",
      },
    },
  },

  // Every font on the site, the app's and the extra ones for sheets (see
  // shared/fonts.ts). `global` loads them even when no app CSS mentions them,
  // since Sheet CSS may use any of them.
  fonts: {
    families: siteFonts.map(({ name, weights }) => ({
      name,
      provider: "google",
      weights,
      global: true,
    })),
  },

  // Icons come only from collections bundled with the app (Lucide, and
  // game-icons for sheets; SHEET_ICON_COLLECTIONS in shared/sheet/validate.ts),
  // served by its own endpoint. No fallback to Iconify's public API, so a
  // page never makes browsers fetch icons from a third party.
  icon: {
    provider: "server",
    fallbackToApi: false,
    serverBundle: { collections: ["lucide", "game-icons"] },
  },

  scalar: {
    // Light like the rest of the site.
    darkMode: false,
    forceDarkModeState: "light",
    hideDarkModeToggle: true,
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
