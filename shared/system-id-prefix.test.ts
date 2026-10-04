import { describe, expect, it } from "vitest";
import { systemIdPrefix } from "./system-id-prefix";

describe("systemIdPrefix", () => {
  it("keeps short system IDs whole", () => {
    expect(systemIdPrefix("pf2e")).toBe("pf2e");
    expect(systemIdPrefix("dnd-2024")).toBe("dnd-2024");
    expect(systemIdPrefix("abcdefgh")).toBe("abcdefgh");
  });

  it("shortens long ones to initials, keeping parts with digits", () => {
    expect(systemIdPrefix("pathfinder-2e")).toBe("p2e");
    expect(systemIdPrefix("dungeons-and-dragons-5e")).toBe("dad5e");
    expect(systemIdPrefix("pf2e-test-system")).toBe("pf2ets");
    expect(systemIdPrefix("call-of-cthulhu")).toBe("coc");
  });

  it("keeps every part that holds a digit", () => {
    expect(systemIdPrefix("2024-5e-rules")).toBe("20245er");
    expect(systemIdPrefix("13th-age-2e")).toBe("13tha2e");
    expect(systemIdPrefix("abcdefghi")).toBe("a");
  });

  it("shortens a long single word to its first letter", () => {
    expect(systemIdPrefix("starfinder")).toBe("s");
  });
});
