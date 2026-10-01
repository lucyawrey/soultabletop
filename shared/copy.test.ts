import { describe, expect, it } from "vitest";
import copy from "../content/copy.yml";

// The keys `shared/yaml.d.ts` declares for `content/copy.yml`. Keep the three in step.
const declaredKeys = {
  site: ["title", "description"],
  home: ["badge", "heading", "intro", "registerNote", "signInNote"],
  dashboard: ["heading", "subheading"],
};

describe("content/copy.yml", () => {
  it("has exactly the declared sections and keys", () => {
    const actual = Object.fromEntries(
      Object.entries(copy).map(([section, values]) => [
        section,
        Object.keys(values as object),
      ]),
    );
    expect(actual).toEqual(declaredKeys);
  });

  it("has only non-empty strings", () => {
    for (const values of Object.values(copy))
      for (const value of Object.values(values as Record<string, unknown>)) {
        expect(typeof value).toBe("string");
        expect((value as string).trim()).not.toBe("");
      }
  });
});
