import { cookies } from "next/headers";
import { sessionSecret } from "../commerce/local-session.ts";
import { hmacSha256Hex, safeEqual } from "../commerce/signatures.ts";

const COOKIE = "kapo-support";

export type SupportSession = {
  id: string;
  email: string;
};

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 120;
}

export function cleanEmail(value: unknown) {
  const email = String(value ?? "").replace(/[\r\n]+/g, " ").trim().toLowerCase().slice(0, 120);
  return isEmail(email) ? email : null;
}

export async function readSupportSession(): Promise<SupportSession | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = await hmacSha256Hex(secret, body);
  if (!safeEqual(expected, signature)) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(body)) as Partial<SupportSession>;
    if (!parsed.id || !parsed.email || !isEmail(parsed.email)) return null;
    return { id: parsed.id, email: parsed.email.toLowerCase() };
  } catch {
    return null;
  }
}

export async function sealSupportSession(session: SupportSession) {
  const secret = sessionSecret();
  if (!secret) return null;
  const body = toBase64Url(JSON.stringify({ id: session.id, email: session.email }));
  return `${body}.${await hmacSha256Hex(secret, body)}`;
}

export const SUPPORT_COOKIE = COOKIE;

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
