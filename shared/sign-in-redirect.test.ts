import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./sign-in-redirect";

describe("safeRedirectPath", () => {
  it("accepts paths on this site, with query and hash", () => {
    expect(safeRedirectPath("/systems/abc")).toBe("/systems/abc");
    expect(safeRedirectPath("/types?systemId=1#top")).toBe("/types?systemId=1#top");
  });

  it("rejects other sites", () => {
    expect(safeRedirectPath("https://evil.example")).toBeUndefined();
    expect(safeRedirectPath("//evil.example")).toBeUndefined();
    expect(safeRedirectPath("/\\evil.example")).toBeUndefined();
    expect(safeRedirectPath("javascript:alert(1)")).toBeUndefined();
    expect(safeRedirectPath("evil.example/path")).toBeUndefined();
  });

  it("rejects backslashes and control characters anywhere", () => {
    expect(safeRedirectPath("/a\\b")).toBeUndefined();
    expect(safeRedirectPath("/a\nb")).toBeUndefined();
    expect(safeRedirectPath("/a\tb")).toBeUndefined();
  });

  it("rejects the home page, non-strings, and oversized values", () => {
    expect(safeRedirectPath("/")).toBeUndefined();
    expect(safeRedirectPath("")).toBeUndefined();
    expect(safeRedirectPath(undefined)).toBeUndefined();
    expect(safeRedirectPath(["/systems"])).toBeUndefined();
    expect(safeRedirectPath("/" + "a".repeat(2000))).toBeUndefined();
  });
});
