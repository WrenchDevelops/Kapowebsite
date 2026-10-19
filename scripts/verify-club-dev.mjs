// Explicit opt-in integration test. Only a Clerk development test identity and localhost.
import assert from "node:assert/strict";
import { createClerkClient } from "@clerk/backend";
import { readFileSync } from "node:fs";

process.loadEnvFile(".env.local");
if (!process.argv.includes("--run"))
  throw Error(
    "Pass --run to create/revoke a session for the isolated Clerk test user.",
  );
if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"))
  throw Error("Only Clerk development keys may run this test.");
const fixture = JSON.parse(
  readFileSync(".wrangler/club-test-user-result.json", "utf8"),
);
const client = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});
const user = await client.users.getUser(fixture.id);
if (
  !user.emailAddresses.some(
    (entry) => entry.emailAddress === "kapo-club+clerk_test@example.com",
  )
)
  throw Error("Refusing to test a non-fixture account.");
const origin = "http://localhost:3000";
const session = await client.sessions.createSession({ userId: user.id });
try {
  const { jwt } = await client.sessions.getToken(session.id);
  const request = async (path, body, more = {}) => {
    const response = await fetch(origin + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Origin: origin,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...more,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  // BAPI-created tokens deliberately have no browser authorized-party claim.
  // Keep the application strict: these must NOT gain browser-account access.
  const denied = await request("/api/club");
  assert.equal(denied.status, 401);
  const primary = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  );
  assert.equal(primary.verification.status, "verified");
  assert.equal((await client.sessions.getSession(session.id)).status, "active");
  await client.sessions.revokeSession(session.id);
  assert.notEqual(
    (await client.sessions.getSession(session.id)).status,
    "active",
  );
  assert.equal((await request("/api/club")).status, 401);
  console.log(
    JSON.stringify({
      verifiedDevelopmentFixture: true,
      missingAuthorizedPartyDenied: true,
      authoritativeRevocationObserved: true,
      inactiveSessionDenied: true,
      browserOtpFlowRequiresBrowserTest: true,
    }),
  );
} finally {
  await client.sessions.revokeSession(session.id).catch(() => undefined);
}
