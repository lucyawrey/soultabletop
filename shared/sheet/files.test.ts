import { describe, expect, it } from "vitest";
import { MAX_SHEET_CSS_LENGTH, readSheetFile, sheetExportFileName } from "./files";

function file(name: string, text: string, size = new TextEncoder().encode(text).length) {
  return { name, size, text: async () => text };
}

describe("readSheetFile", () => {
  it("reads markup and CSS files", async () => {
    await expect(readSheetFile(file("fighter.stts", "<Stack />"), "markup")).resolves.toEqual({
      text: "<Stack />",
    });
    await expect(readSheetFile(file("Fighter.HTML", "<Stack />"), "markup")).resolves.toEqual({
      text: "<Stack />",
    });
    await expect(readSheetFile(file("fighter.css", ".a {}"), "css")).resolves.toEqual({
      text: ".a {}",
    });
  });

  it("drops a byte order mark", async () => {
    await expect(readSheetFile(file("a.css", "\uFEFF.a {}"), "css")).resolves.toEqual({
      text: ".a {}",
    });
  });

  it("rejects other extensions", async () => {
    await expect(readSheetFile(file("a.css", ".a {}"), "markup")).resolves.toHaveProperty("error");
    await expect(readSheetFile(file("a.png", ""), "css")).resolves.toHaveProperty("error");
  });

  it("rejects files over the limit without reading huge ones", async () => {
    const long = "a".repeat(MAX_SHEET_CSS_LENGTH + 1);
    await expect(readSheetFile(file("a.css", long), "css")).resolves.toHaveProperty("error");
    let read = false;
    const huge = {
      name: "a.css",
      size: MAX_SHEET_CSS_LENGTH * 4 + 1,
      text: async () => ((read = true), ""),
    };
    await expect(readSheetFile(huge, "css")).resolves.toHaveProperty("error");
    expect(read).toBe(false);
  });

  it("rejects binary content", async () => {
    await expect(readSheetFile(file("a.txt", "a\0b"), "css")).resolves.toHaveProperty("error");
    await expect(readSheetFile(file("a.txt", "a\uFFFDb"), "markup")).resolves.toHaveProperty(
      "error",
    );
  });
});

describe("sheetExportFileName", () => {
  it("names files after the readableId", () => {
    expect(sheetExportFileName("fighter", "markup")).toBe("fighter.stts");
    expect(sheetExportFileName("fighter", "css")).toBe("fighter.css");
    expect(sheetExportFileName("", "css")).toBe("sheet.css");
  });
});
