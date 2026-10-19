import assert from "node:assert/strict";
import test from "node:test";
const base = process.env.KAPO_TEST_BASE_URL || "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw Error("HTTP security tests may only target a local server.");
const forged = { "oai-authenticated-user-id": "forged-user", "oai-authenticated-user-email": "forged@example.invalid", "x-clerk-auth-status": "signed-in", "x-clerk-auth-user-id": "forged-user" };
test("untrusted identity headers and invalid session JWT cannot read Club data", async () => {
  for (const headers of [forged, { Authorization: "Bearer invalid.jwt.token" }]) {
    const response = await fetch(`${base}/api/club`, { headers });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).balance, undefined);
  }
});
test("the old email-only login route cannot issue an account cookie", async () => {
  const response = await fetch(`${base}/api/account/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "forged@example.invalid", name: "Forged" }) });
  assert.equal(response.status, 410); assert.equal(response.headers.has("set-cookie"), false);
});
test("every admin mutation rejects a forged administrator", async () => {
  for (const path of ["/api/admin/rewards", "/api/admin/email", "/api/admin/marketing", "/api/admin/products/macropad", "/api/admin/orders/synthetic"]) {
    const response = await fetch(base + path, { method: "POST", headers: { ...forged, Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ action: "adjust", delta: 100000 }) });
    assert.equal(response.status, 403, path);
  }
});
test("Club and admin mutations reject cross-origin requests before performing work", async () => {
  for (const path of ["/api/club", "/api/admin/rewards", "/api/admin/email"]) {
    const response = await fetch(base + path, { method: "POST", headers: { Origin: "https://attacker.invalid", "Content-Type": "application/json" }, body: JSON.stringify({ action: "profile", name: "Attacker" }) });
    assert.equal(response.status, 403, path);
  }
});
test("private order page cannot be opened by forging the previous identity headers", async () => {
  const response = await fetch(`${base}/account/orders/SYNTHETIC-ORDER`, { headers: forged, redirect: "manual" });
  assert.ok([302, 303, 307].includes(response.status));
  assert.equal(response.headers.get("location"), "/account");
});
