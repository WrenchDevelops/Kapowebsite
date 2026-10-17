export function isAdminEmail(email: string | null | undefined, allowlist: string | undefined) {
  if (!email || !allowlist?.trim()) return false;
  const allowed = new Set(allowlist.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean));
  return allowed.has(email.trim().toLowerCase());
}

export function customerCanViewOrder(order: { customerUserId: string | null; customerEmail: string }, user: { userId: string; email: string }) {
  if (order.customerUserId && order.customerUserId === user.userId) return true;
  return order.customerEmail.trim().toLowerCase() === user.email.trim().toLowerCase();
}

export function liveModeBlocked(key: string, kind: "stripe" | "shippo", allowLive: boolean) {
  const live = kind === "stripe" ? key.startsWith("sk_live_") : key.startsWith("shippo_live_");
  if (!live || allowLive) return null;
  return kind === "stripe"
    ? "Live Stripe charges are blocked until KAPO_ALLOW_LIVE_PAYMENTS=true."
    : "Live Shippo label purchases are blocked until KAPO_ALLOW_LIVE_LABELS=true.";
}
