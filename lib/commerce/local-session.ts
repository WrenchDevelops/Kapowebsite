import { cookies } from "next/headers";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { readEnv } from "./env.ts";
import { hmacSha256Hex, safeEqual } from "./signatures.ts";

const COOKIE = "kapo-account";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function sessionSecret() {
  const configured = readEnv("KAPO_SESSION_SECRET");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return "kapo-local-dev-session";
}

export async function readLocalUser(): Promise<ChatGPTUser | null> {
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
    const parsed = JSON.parse(fromBase64Url(body)) as Partial<ChatGPTUser>;
    if (!parsed.userId || !parsed.email || !parsed.email.includes("@")) return null;
    return {
      userId: parsed.userId,
      email: parsed.email.toLowerCase(),
      displayName: parsed.displayName || parsed.email,
      fullName: parsed.fullName ?? parsed.displayName ?? null,
    };
  } catch {
    return null;
  }
}

export async function sealLocalUser(input: { name: string; email: string }) {
  const secret = sessionSecret();
  if (!secret) return null;
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const user: ChatGPTUser = {
    userId: `local:${(await hmacSha256Hex("kapo-user", email)).slice(0, 24)}`,
    email,
    displayName: name,
    fullName: name,
  };
  const body = toBase64Url(JSON.stringify(user));
  return { token: `${body}.${await hmacSha256Hex(secret, body)}`, user };
}

export function accountCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    secure,
  };
}

export const ACCOUNT_COOKIE = COOKIE;

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
