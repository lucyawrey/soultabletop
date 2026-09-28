// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import { getDefaultAttributes } from "eslint-plugin-better-tailwindcss/api/defaults";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default withNuxt(
  betterTailwindcss.configs["correctness-error"],
  {
    rules: {
      // `sheet-*` classes are hooks for user-written Sheet CSS, not Tailwind.
      "better-tailwindcss/no-unknown-classes": ["error", { ignore: ["^sheet-"] }],
    },
  },
  {
    settings: {
      "better-tailwindcss": {
        entryPoint: "app/assets/css/main.css",
        attributes: [
          ...getDefaultAttributes(),
          ["^v-bind:ui$", [{ match: "objectValues" }]],
        ],
      },
    },
  },
  eslintConfigPrettier,
);
