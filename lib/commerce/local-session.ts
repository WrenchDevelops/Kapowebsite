import { readEnv } from "./env.ts";
// Only seals anonymous support cookies. Never authenticates a customer account.
export function sessionSecret() { return readEnv("KAPO_SESSION_SECRET") || null; }
export function accountCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 7, secure };
}
export const ACCOUNT_COOKIE = "kapo-account";
