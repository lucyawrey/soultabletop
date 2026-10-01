import { describe, expect, it } from "vitest";
import { formatUserLabel, resolveDisplayName, syncedDisplayName } from "./display-name";

describe("resolveDisplayName", () => {
  it("keeps a given name, trimmed", () => {
    expect(resolveDisplayName("  Lucy A. ", "lucy")).toBe("Lucy A.");
  });

  it("falls back to the username when empty, blank, or not a string", () => {
    expect(resolveDisplayName("", "Lucy")).toBe("Lucy");
    expect(resolveDisplayName("   ", "Lucy")).toBe("Lucy");
    expect(resolveDisplayName(undefined, "Lucy")).toBe("Lucy");
    expect(resolveDisplayName(null, "Lucy")).toBe("Lucy");
    expect(resolveDisplayName(42, "Lucy")).toBe("Lucy");
  });
});

describe("formatUserLabel", () => {
  it("adds the username as a handle", () => {
    expect(formatUserLabel("Lucy A.", "lucy")).toBe("Lucy A. (@lucy)");
  });

  it("drops the handle when the name is the username, ignoring case", () => {
    expect(formatUserLabel("Lucy", "lucy")).toBe("Lucy");
  });

  it("shows only the name without a username", () => {
    expect(formatUserLabel("Lucy A.", null)).toBe("Lucy A.");
    expect(formatUserLabel("Lucy A.")).toBe("Lucy A.");
  });
});

describe("syncedDisplayName", () => {
  it("follows the username when the name is the old username, any capitalization", () => {
    expect(syncedDisplayName("lucy", "lucy", "Lucy-2")).toBe("Lucy-2");
    expect(syncedDisplayName("LUCY", "lucy", "new-name")).toBe("new-name");
    expect(syncedDisplayName("Lucy", "lucy", " Bee ")).toBe("Bee");
  });

  it("leaves a customized name alone", () => {
    expect(syncedDisplayName("Lucy A.", "lucy", "lucy-2")).toBeUndefined();
  });

  it("follows when the current name is empty", () => {
    expect(syncedDisplayName("  ", "lucy", "Bee")).toBe("Bee");
  });

  it("does nothing when the username is unchanged apart from case or empty", () => {
    expect(syncedDisplayName("lucy", "lucy", "Lucy")).toBeUndefined();
    expect(syncedDisplayName("lucy", "lucy", "  ")).toBeUndefined();
  });
});
