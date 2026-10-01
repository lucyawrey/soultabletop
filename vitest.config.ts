import yaml from "@rollup/plugin-yaml";
import { defineConfig } from "vitest/config";

// Unit tests for framework-free code (e.g. the sheet parser in shared/).
export default defineConfig({
  plugins: [yaml()],
  test: {
    include: ["shared/**/*.test.ts", "server/**/*.test.ts"],
    passWithNoTests: true,
  },
});
