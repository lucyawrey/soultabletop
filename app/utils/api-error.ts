export interface BrokenSheet {
  id: string;
  name: string;
  contentTypeId: string;
  errors: string[];
}

// The Sheets a ContentType schema change would break, from the 409 that
// `PATCH /api/content-type/[id]` returns without `confirmBrokenSheets`.
export function extractBrokenSheets(error: unknown): BrokenSheet[] | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) return;
  const data = (error as { data?: { statusCode?: unknown; data?: unknown } })
    .data;
  if (data?.statusCode !== 409) return;
  const details = data.data;
  if (details && typeof details === "object" && "brokenSheets" in details) {
    const sheets = (details as { brokenSheets?: unknown }).brokenSheets;
    if (Array.isArray(sheets)) return sheets as BrokenSheet[];
  }
}

interface ValidationErrorDetail {
  path?: unknown;
  message?: unknown;
}

export function extractApiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "data" in data) {
      const details = (data as { data?: unknown }).data;
      if (Array.isArray(details) && details.length > 0) {
        const messages = details
          .filter(
            (item): item is ValidationErrorDetail =>
              !!item && typeof item === "object" && "message" in item,
          )
          .map((item) => {
            const path = String(item.path ?? "").replace(/^\//, "");
            return path ? `${path}: ${item.message}` : String(item.message);
          });
        if (messages.length) return messages.join("; ");
      }
    }
    if (
      data &&
      typeof data === "object" &&
      "statusMessage" in data &&
      typeof (data as { statusMessage?: unknown }).statusMessage === "string"
    ) {
      return (data as { statusMessage: string }).statusMessage;
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
