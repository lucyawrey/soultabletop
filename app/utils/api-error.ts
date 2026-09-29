export interface BrokenSheet {
  id: string;
  name: string;
  contentTypeId: string;
  errors: string[];
}

export interface BrokenSheets {
  // Sheets you can read, with details.
  sheets: BrokenSheet[];
  // Other broken Sheets you can't read.
  hiddenCount: number;
}

// The Sheets a ContentType schema change would break, from the 409 that
// `PATCH /api/content-type/[id]` returns without `confirmBrokenSheets`.
export function extractBrokenSheets(error: unknown): BrokenSheets | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) return;
  const data = (error as { data?: { statusCode?: unknown; data?: unknown } })
    .data;
  if (data?.statusCode !== 409) return;
  const details = data.data as
    | { brokenSheets?: unknown; hiddenBrokenSheets?: unknown }
    | undefined;
  if (!details || !Array.isArray(details.brokenSheets)) return;
  return {
    sheets: details.brokenSheets as BrokenSheet[],
    hiddenCount:
      typeof details.hiddenBrokenSheets === "number"
        ? details.hiddenBrokenSheets
        : 0,
  };
}

// The message of the 409 that `POST /api/sheet` and `PATCH /api/sheet/[id]`
// return when making a Sheet the default would replace another default
// without `confirmReplaceDefault`.
export function extractDefaultReplacement(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) return;
  const data = (
    error as {
      data?: { statusCode?: unknown; statusMessage?: unknown; data?: unknown };
    }
  ).data;
  if (data?.statusCode !== 409) return;
  const details = data.data;
  if (!details || typeof details !== "object") return;
  if (!("currentDefaultSheet" in details)) return;
  return typeof data.statusMessage === "string"
    ? data.statusMessage
    : "This replaces the current default Sheet";
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
