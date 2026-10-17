import { CommerceError } from "./errors.ts";

export { CommerceError };

export async function readJson(request: Request, maxBytes = 40_000) {
  const text = await request.text();
  if (text.length > maxBytes) throw new CommerceError("That request is too large.", 413, "payload_too_large");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CommerceError("The request could not be read.", 400, "invalid_json");
  }
}

export function jsonError(error: unknown) {
  if (error instanceof CommerceError) {
    return Response.json({ message: error.message, code: error.code }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("no such table") || message.includes("D1 binding")) {
    return Response.json({ message: "The order database is not ready. Apply the commerce migration to the D1 database.", code: "database_unavailable" }, { status: 503 });
  }
  return Response.json({ message: "Something went wrong. Please try again.", code: "server_error" }, { status: 500 });
}
