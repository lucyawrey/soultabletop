// "Oct 2, 2026": how lists, cards, and About panels show dates.
export function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}
