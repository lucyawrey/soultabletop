import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { METHOD_GUARDED_ROUTES } from "./method-not-allowed";

const API_DIR = join(import.meta.dirname, "../api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? routeFiles(join(dir, entry.name))
      : [relative(API_DIR, join(dir, entry.name))],
  );
}

// Every API route, as Nitro registers it, with the methods its files handle.
function apiRoutes() {
  const routes = new Map<string, string[]>();
  for (const file of routeFiles(API_DIR)) {
    if (file.endsWith(".test.ts")) continue;
    const match = /^(.*?)(?:\.(get|post|patch|put|delete))?\.ts$/.exec(file);
    if (!match) continue;
    const path = `/api/${match[1]!}`
      .replace(/(^|\/)index$/, "")
      .replace(/\[\.\.\.(\w+)\]/g, "**:$1")
      .replace(/\[(\w+)\]/g, ":$1");
    routes.set(path, [...(routes.get(path) ?? []), (match[2] ?? "all").toUpperCase()]);
  }
  return routes;
}

function staticAfterParameter(path: string) {
  const segments = path.split("/").filter(Boolean);
  const firstParameter = segments.findIndex((segment) => /^[:*]/.test(segment));
  return (
    firstParameter !== -1 &&
    segments.slice(firstParameter + 1).some((segment) => !/^[:*]/.test(segment))
  );
}

describe("METHOD_GUARDED_ROUTES", () => {
  it("lists every route with a static segment after a parameter, with its methods", () => {
    const expected = Object.fromEntries(
      [...apiRoutes()]
        .filter(([path]) => staticAfterParameter(path))
        .map(([path, methods]) => [path, methods.sort()]),
    );
    const actual = Object.fromEntries(
      Object.entries(METHOD_GUARDED_ROUTES).map(([path, methods]) => [path, [...methods].sort()]),
    );
    expect(actual).toEqual(expected);
  });
});
