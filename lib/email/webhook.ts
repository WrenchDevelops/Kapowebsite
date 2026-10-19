const MAX_AGE_SECONDS = 5 * 60;

export async function verifyResendWebhook(options: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  payload: string;
  nowSeconds?: number;
}) {
  const { secret, id, timestamp, signature, payload } = options;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_AGE_SECONDS) return false;
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let secretBytes: Uint8Array<ArrayBuffer>;
  try {
    const decoded = Uint8Array.from(atob(raw), (char) => char.charCodeAt(0));
    secretBytes = new Uint8Array(decoded.byteLength);
    secretBytes.set(decoded);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return signature.split(" ").some((part) => {
    const value = part.includes(",") ? part.slice(part.indexOf(",") + 1) : part;
    return value.length === expected.length && timingEqual(value, expected);
  });
}

export function notificationStatusForEvent(type: string) {
  switch (type) {
    case "email.delivered":
      return "delivered";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.failed":
      return "failed";
    case "email.delivery_delayed":
      return "delayed";
    case "email.sent":
      return "sent";
    default:
      return null;
  }
}

function timingEqual(left: string, right: string) {
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}
