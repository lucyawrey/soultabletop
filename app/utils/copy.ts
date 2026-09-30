import copyData from "~/copy.yml";

// The team's copy (see `app/copy.yml`), typed by its own shape.
export const copy: typeof copyData = copyData;

// Fills `{name}`-style markers in a copy string.
export function fillCopy(text: string, values: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (marker, key: string) => values[key] ?? marker);
}
