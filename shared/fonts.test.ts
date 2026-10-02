import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { siteFonts } from "./fonts";

// The font list in shared/fonts.ts, the font table in docs/theme.md (designer
// and license per font), and the app's `--font-*` variables stay in sync.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const themeDoc = read("../docs/theme.md");
const css = read("../app/assets/css/main.css");

describe("site fonts", () => {
  it.each(siteFonts)("$name has a row in docs/theme.md's font table, with its weights", ({ name, weights }) => {
    const row = themeDoc.match(new RegExp(`^\\| ${name} \\|[^|]*\\| ([^|]*) \\|`, "m"));
    expect(row?.[1]).toBe(weights.join(", "));
  });

  it.each(["sans", "display", "mono"])("--font-%s starts with a listed font", (kind) => {
    const value = css.match(new RegExp(`--font-${kind}:\\s*"([^"]+)"`))?.[1];
    expect(siteFonts.map((font) => font.name)).toContain(value);
  });
});
