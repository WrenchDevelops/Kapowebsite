export type ShippoAccess = {
  mode: "test" | "live";
  token: string;
  livePurchasing: boolean;
  liveBlocked: boolean;
};

export function resolveShippoAccess(input: {
  mode?: string;
  testKey?: string;
  liveKey?: string;
  legacyToken?: string;
  allowLiveLabels: boolean;
}): ShippoAccess {
  const requested = (input.mode ?? "test").trim().toLowerCase();
  const testKey = testToken(input.testKey, input.legacyToken);
  if (requested === "live") {
    if (!input.allowLiveLabels) {
      return { mode: "test", token: testKey, livePurchasing: false, liveBlocked: true };
    }
    const liveKey = liveToken(input.liveKey, input.legacyToken);
    return { mode: "live", token: liveKey, livePurchasing: liveKey.startsWith("shippo_live_"), liveBlocked: false };
  }
  return { mode: "test", token: testKey, livePurchasing: false, liveBlocked: false };
}

function testToken(primary: string | undefined, legacy: string | undefined) {
  if (primary?.startsWith("shippo_test_")) return primary;
  if (legacy?.startsWith("shippo_test_")) return legacy;
  return "";
}

function liveToken(primary: string | undefined, legacy: string | undefined) {
  if (primary?.startsWith("shippo_live_")) return primary;
  if (legacy?.startsWith("shippo_live_")) return legacy;
  return "";
}
