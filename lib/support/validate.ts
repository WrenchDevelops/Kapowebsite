export function parseSupportRequest(body: { message?: unknown; idempotencyKey?: unknown }) {
  const message = String(body.message ?? "").replace(/\r\n/g, "\n").trim().slice(0, 4000);
  const idempotencyKey = String(body.idempotencyKey ?? "").trim().slice(0, 80);
  if (message.length < 4 || !/^[a-zA-Z0-9-]{8,80}$/.test(idempotencyKey)) return null;
  return { message, idempotencyKey };
}
