import type { ExtractResponse } from "./types";

export async function extractContract(
  text: string,
  signal?: AbortSignal,
): Promise<ExtractResponse> {
  const response = await fetch("/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail =
      typeof body?.detail === "string"
        ? body.detail
        : `Request failed (${response.status})`;
    throw new Error(detail);
  }

  return response.json();
}
