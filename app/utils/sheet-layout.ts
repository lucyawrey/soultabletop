// Static class lookups for Sheet layout attributes. Tailwind only generates
// classes it can find written out in full, so they can't be built from
// numbers at runtime.

export const sheetGridCols: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
  7: "sm:grid-cols-4 lg:grid-cols-7",
  8: "sm:grid-cols-4 lg:grid-cols-8",
  9: "sm:grid-cols-3 lg:grid-cols-9",
  10: "sm:grid-cols-5 lg:grid-cols-10",
  11: "sm:grid-cols-4 lg:grid-cols-11",
  12: "sm:grid-cols-6 lg:grid-cols-12",
};

export const sheetColSpan: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  5: "sm:col-span-5",
  6: "sm:col-span-6",
  7: "sm:col-span-7",
  8: "sm:col-span-8",
  9: "sm:col-span-9",
  10: "sm:col-span-10",
  11: "sm:col-span-11",
  12: "sm:col-span-12",
};

export const sheetGap: Record<string, string> = {
  none: "gap-0",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};

// `gap` on compact sheets (`<Sheet density="compact">`): one step tighter.
export const sheetGapCompact: Record<string, string> = {
  none: "gap-0",
  sm: "gap-1",
  md: "gap-2",
  lg: "gap-3",
};

export const sheetAlign: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};
