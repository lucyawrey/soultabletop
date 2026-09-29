// Loading Sheet markup and CSS from local files and naming exported ones, for
// authoring outside the site. Files are read in the browser; nothing is
// uploaded. See docs/sheet-system.md, section 7.

import { sheetParseLimits } from "./parser";

// Kept here rather than in css.ts so the editor can check file sizes without
// loading postcss.
export const MAX_SHEET_CSS_LENGTH = 50_000;

export type SheetFileKind = "markup" | "css";

export const sheetFileTypes: Record<
  SheetFileKind,
  { extensions: string[]; exportExtension: string; mimeType: string; maxLength: number; label: string }
> = {
  markup: {
    // .stts: Soul Tabletop Sheet.
    extensions: [".stts", ".xml", ".html", ".htm", ".txt"],
    exportExtension: ".stts",
    mimeType: "text/plain",
    maxLength: sheetParseLimits.maxSourceLength,
    label: "Markup",
  },
  css: {
    extensions: [".css", ".txt"],
    exportExtension: ".css",
    mimeType: "text/css",
    maxLength: MAX_SHEET_CSS_LENGTH,
    label: "CSS",
  },
};

// The parts of a browser `File` this needs.
export interface SheetFileSource {
  name: string;
  size: number;
  text(): Promise<string>;
}

export type SheetFileResult = { text: string } | { error: string };

export async function readSheetFile(
  file: SheetFileSource,
  kind: SheetFileKind,
): Promise<SheetFileResult> {
  const { extensions, maxLength, label } = sheetFileTypes[kind];
  const lower = file.name.toLowerCase();
  if (!extensions.some((extension) => lower.endsWith(extension)))
    return { error: `${label} files must end in ${extensions.join(", ")}.` };
  const tooLong = `${file.name} is too large; the limit is ${maxLength.toLocaleString()} characters.`;
  // A character takes at most 4 bytes in UTF-8, so skip reading files that
  // can't fit.
  if (file.size > maxLength * 4) return { error: tooLong };
  const text = (await file.text()).replace(/^\uFEFF/, "");
  if (text.length > maxLength) return { error: tooLong };
  // Binary files decode with NUL characters or U+FFFD for invalid bytes.
  if (/[\0\uFFFD]/.test(text)) return { error: `${file.name} isn't a text file.` };
  return { text };
}

// A file name for exporting, from the Sheet's slug.
export function sheetExportFileName(slug: string, kind: SheetFileKind) {
  return `${slug || "sheet"}${sheetFileTypes[kind].exportExtension}`;
}
