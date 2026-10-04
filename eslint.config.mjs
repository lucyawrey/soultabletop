// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import { getDefaultAttributes } from "eslint-plugin-better-tailwindcss/api/defaults";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default withNuxt(
  // Third-party skills (installed with the `skills` CLI) and Obsidian plugins
  // carry their own code.
  { ignores: [".claude/skills/**", ".obsidian/**"] },
  betterTailwindcss.configs["correctness-error"],
  {
    rules: {
      // `sheet-*` classes are hooks for user-written Sheet CSS, not Tailwind.
      "better-tailwindcss/no-unknown-classes": ["error", { ignore: ["^sheet-"] }],
    },
  },
  {
    // Fail on imports of packages missing from package.json (they only resolve
    // while a transitive dependency happens to be installed). The `import`
    // plugin comes with @nuxt/eslint; the default only allows `dependencies`.
    rules: {
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: [
            "*.config.{js,mjs,ts}",
            "scripts/**",
            "**/*.test.ts",
          ],
        },
      ],
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
