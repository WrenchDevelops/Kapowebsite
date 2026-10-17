const SHIPPO_IPS = new Set([
  "52.4.41.98",
  "52.23.121.194",
  "52.44.110.80",
  "54.81.253.187",
  "54.81.255.221",
  "34.248.247.69",
  "34.253.119.130",
  "52.214.174.64",
  "54.72.179.250",
]);

export function safeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return mismatch === 0;
}

export async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseSignatureHeader(header: string) {
  const parts = Object.fromEntries(header.split(",").map((part) => {
    const [key, ...rest] = part.split("=");
    return [key?.trim(), rest.join("=").trim()];
  }));
  return { timestamp: parts.t ?? "", signatures: [parts.v1].filter(Boolean) };
}

export async function verifyTimestampedHmac(options: {
  header: string | null;
  payload: string;
  secret: string;
  nowSeconds: number;
  toleranceSeconds?: number;
}) {
  if (!options.header || !options.secret) return false;
  const { timestamp, signatures } = parseSignatureHeader(options.header);
  const issued = Number(timestamp);
  if (!Number.isFinite(issued) || signatures.length === 0) return false;
  const tolerance = options.toleranceSeconds ?? 300;
  if (Math.abs(options.nowSeconds - issued) > tolerance) return false;
  const expected = await hmacSha256Hex(options.secret, `${timestamp}.${options.payload}`);
  return signatures.some((signature) => safeEqual(signature, expected));
}

export function shippoIpAllowed(ip: string | null, enforce: boolean) {
  if (!enforce) return true;
  return Boolean(ip && SHIPPO_IPS.has(ip));
}

export async function hashValue(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
