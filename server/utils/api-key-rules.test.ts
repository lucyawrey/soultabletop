import { describe, expect, it } from "vitest";
import {
  apiKeyAccess,
  apiKeyPermissions,
  isReadOnlyMethod,
  readApiKey,
} from "./api-key-rules";

describe("readApiKey", () => {
  it("reads x-api-key", () => {
    expect(readApiKey(new Headers({ "x-api-key": " st_abc " }))).toBe("st_abc");
  });

  it("reads a Bearer token, with any casing of the scheme", () => {
    expect(readApiKey(new Headers({ authorization: "Bearer st_abc" }))).toBe("st_abc");
    expect(readApiKey(new Headers({ authorization: "bearer   st_abc" }))).toBe("st_abc");
  });

  it("prefers x-api-key over Authorization", () => {
    expect(
      readApiKey(new Headers({ "x-api-key": "st_one", authorization: "Bearer st_two" })),
    ).toBe("st_one");
  });

  it("ignores other schemes, empty values, and missing headers", () => {
    expect(readApiKey(new Headers({ authorization: "Basic dXNlcjpwYXNz" }))).toBeNull();
    expect(readApiKey(new Headers({ authorization: "Bearer" }))).toBeNull();
    expect(readApiKey(new Headers({ authorization: "Bearer a b" }))).toBeNull();
    expect(readApiKey(new Headers({ "x-api-key": "  " }))).toBeNull();
    expect(readApiKey(new Headers())).toBeNull();
  });
});

describe("apiKeyAccess", () => {
  it("round-trips both access levels", () => {
    expect(apiKeyAccess(apiKeyPermissions("read"))).toBe("read");
    expect(apiKeyAccess(apiKeyPermissions("full"))).toBe("full");
    expect(apiKeyAccess(JSON.stringify(apiKeyPermissions("full")))).toBe("full");
  });

  it("treats missing or malformed permissions as read-only", () => {
    expect(apiKeyAccess(null)).toBe("read");
    expect(apiKeyAccess(undefined)).toBe("read");
    expect(apiKeyAccess("not json")).toBe("read");
    expect(apiKeyAccess({ api: "write" })).toBe("read");
    expect(apiKeyAccess({ other: ["write"] })).toBe("read");
  });
});

describe("isReadOnlyMethod", () => {
  it("allows only methods that don't change data", () => {
    expect(["GET", "head", "OPTIONS"].map(isReadOnlyMethod)).toEqual([true, true, true]);
    expect(["POST", "PATCH", "PUT", "DELETE"].map(isReadOnlyMethod)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});
