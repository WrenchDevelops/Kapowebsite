export function isUniqueError(error: unknown) {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  return /unique/i.test(parts.join(" "));
}

export function subscriptionPlan(existing: { status: string } | null, consent: boolean) {
  if (!consent) return { ok: false as const, code: "consent_required" as const };
  if (!existing) return { ok: true as const, action: "create" as const };
  if (existing.status === "confirmed") return { ok: true as const, action: "already" as const };
  if (existing.status === "pending") return { ok: true as const, action: "resend" as const };
  return { ok: true as const, action: "resubscribe" as const };
}

export function campaignSendBlock(input: { mailingAddress: string; confirmedCount: number; status: string }) {
  if (input.status === "sent") return "This campaign was already sent.";
  if (!input.mailingAddress.trim()) return "Set KAPO_MAILING_ADDRESS before sending marketing email.";
  if (input.confirmedCount < 1) return "There are no confirmed subscribers.";
  if (input.confirmedCount > 500) return "More than 500 confirmed subscribers. Set KAPO_RESEND_AUDIENCE_ID and send through Resend Broadcasts.";
  return null;
}

export function webhookClaimDecision(status: string | undefined, ageMs = 0, staleAfterMs = 90_000) {
  if (!status || status === "failed") return "claimed" as const;
  if (status === "processing" && ageMs >= staleAfterMs) return "claimed" as const;
  if (status === "processing") return "in_progress" as const;
  return "duplicate" as const;
}
