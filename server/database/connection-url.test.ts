import { describe, expect, it } from "vitest";
import { withVerifiedSsl } from "./connection-url";

describe("withVerifiedSsl", () => {
  it("replaces the modes pg already treats as verify-full", () => {
    for (const mode of ["require", "prefer", "verify-ca"])
      expect(withVerifiedSsl(`postgres://u:p@h/db?sslmode=${mode}&channel_binding=require`)).toBe(
        "postgres://u:p@h/db?sslmode=verify-full&channel_binding=require",
      );
    expect(withVerifiedSsl("postgres://u:p@h/db?a=1&sslmode=require")).toBe(
      "postgres://u:p@h/db?a=1&sslmode=verify-full",
    );
  });

  it("leaves other URLs alone", () => {
    for (const url of [
      "postgres://u:p@h/db",
      "postgres://u:p@h/db?sslmode=disable",
      "postgres://u:p@h/db?sslmode=verify-full",
      "postgres://u:p@h/db?channel_binding=require",
    ])
      expect(withVerifiedSsl(url)).toBe(url);
  });
});
