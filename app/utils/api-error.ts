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
