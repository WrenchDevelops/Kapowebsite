import { cache } from "react";
import { headers } from "next/headers";
import { createClerkClient } from "@clerk/backend";
import { readEnv } from "../commerce/env.ts";
import { publicSiteUrl } from "../email/addresses.ts";
import { verifiedIdentity } from "./policy.ts";

export function authSettings() {
  const origin = publicSiteUrl(readEnv("KAPO_PUBLIC_SITE_URL"));
  const origins = new Set([origin]);
  for (const value of (readEnv("KAPO_AUTHORIZED_ORIGINS") ?? "")
    .split(",")
    .filter(Boolean)) {
    const url = new URL(value.trim());
    if (
      url.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    )
      origins.add(url.origin);
  }
  if (process.env.NODE_ENV !== "production")
    origins.add("http://localhost:3000");
  return {
    publishableKey: readEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") ?? "",
    secretKey: readEnv("CLERK_SECRET_KEY") ?? "",
    origin,
    authorizedParties: [...origins],
  };
}
export function clerkBackend() {
  const settings = authSettings();
  if (!settings.secretKey || !settings.publishableKey)
    throw new Error("KAPO authentication is not configured.");
  return createClerkClient({
    secretKey: settings.secretKey,
    publishableKey: settings.publishableKey,
  });
}
export async function authenticateShopRequest(request: Request) {
  const settings = authSettings();
  if (!settings.secretKey || !settings.publishableKey) return null;
  try {
    const client = clerkBackend();
    const trustedHeaders = new Headers();
    for (const key of ["cookie", "authorization", "origin"]) {
      const value = request.headers.get(key);
      if (value) trustedHeaders.set(key, value);
    }
    const state = await client.authenticateRequest(
      new Request(`${settings.origin}/account`, { headers: trustedHeaders }),
      {
        authorizedParties: settings.authorizedParties,
        acceptsToken: "session_token",
      },
    );
    if (!state.isAuthenticated) return null;
    const auth = state.toAuth();
    if (!auth?.userId || !auth.sessionId) return null;
    const [session, user] = await Promise.all([
      client.sessions.getSession(auth.sessionId),
      client.users.getUser(auth.userId),
    ]);
    return verifiedIdentity(
      { userId: auth.userId, sessionId: auth.sessionId },
      session,
      user,
    );
  } catch {
    return null;
  }
}
export const currentShopUser = cache(async () => {
  const incoming = await headers();
  return authenticateShopRequest(
    new Request(`${authSettings().origin}/account`, { headers: incoming }),
  );
});
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !authSettings().authorizedParties.includes(origin))
    throw new Error("Request origin is not allowed.");
}
