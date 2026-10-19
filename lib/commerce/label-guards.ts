import { isAdminEmail } from "./authz.ts";
import { formatCents } from "./money.ts";

export const LABEL_PURCHASE_SOURCE = "admin_dashboard";
export const LABEL_MAX_CENTS = 1500;
export const LABEL_DAILY_MAX_CENTS = 5000;
const SPENDING_TIME_ZONE = "America/New_York";

export type LabelPurchaseMode = "unconfigured" | "test" | "live_blocked" | "live";

export function resolveLabelLimits(configuredMax: number, configuredDaily: number, override: boolean) {
  return {
    maxLabelCents: override ? configuredMax : Math.min(configuredMax, LABEL_MAX_CENTS),
    dailyMaxCents: override ? configuredDaily : Math.min(configuredDaily, LABEL_DAILY_MAX_CENTS),
  };
}

export function labelPurchaseMode(token: string, allowLive: boolean): LabelPurchaseMode {
  if (!token) return "unconfigured";
  if (token.startsWith("shippo_test_")) return "test";
  return allowLive ? "live" : "live_blocked";
}

export function spendingDay(now: Date, timeZone = SPENDING_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not resolve the shipping spend day.");
  return `${year}-${month}-${day}`;
}

export function spendingWindow(now: Date, timeZone = SPENDING_TIME_ZONE) {
  const day = spendingDay(now, timeZone);
  const startMs = zonedMidnightUtc(day, timeZone);
  const endMs = zonedMidnightUtc(nextCalendarDay(day), timeZone);
  return { day, startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() };
}

export function authorizeLabelPurchase(input: { source: string; actor: string; adminEmails: string | undefined; devBypass: boolean }) {
  if (input.source !== LABEL_PURCHASE_SOURCE) {
    return { ok: false as const, message: "Only the KAPO admin dashboard can purchase shipping labels." };
  }
  const actor = input.actor.trim().toLowerCase();
  if (input.devBypass && actor === "dev-admin@localhost") return { ok: true as const };
  if (!isAdminEmail(input.actor, input.adminEmails)) {
    return { ok: false as const, message: "Only the KAPO admin dashboard can purchase shipping labels." };
  }
  return { ok: true as const };
}

export function confirmationMatches(
  rate: { id: string; provider: string; serviceName: string; carrierAmountCents: number; currency: string },
  input: { rateId: string; carrier: string; serviceName: string; amountCents: number; confirmed: boolean },
) {
  if (!input.confirmed) {
    return { ok: false as const, message: "Confirm the exact carrier and price before KAPO buys postage." };
  }
  const sameRate = input.rateId === rate.id
    && input.carrier === rate.provider
    && input.serviceName === rate.serviceName
    && input.amountCents === rate.carrierAmountCents
    && rate.currency.toUpperCase() === "USD";
  if (!sameRate) {
    return { ok: false as const, message: "The approved price does not match the selected rate. Refresh rates and approve the exact cost again." };
  }
  return { ok: true as const };
}

export function dailyLimitMessage(dailyMaxCents: number) {
  return `This purchase would exceed the ${formatCents(dailyMaxCents)} daily shipping limit.`;
}

export function priceAllowed(amountCents: number, maxLabelCents: number) {
  if (!Number.isInteger(amountCents) || amountCents < 1) {
    return { ok: false as const, message: "That label price is not valid." };
  }
  if (amountCents > maxLabelCents) {
    return { ok: false as const, message: `That label costs more than the ${formatCents(maxLabelCents)} maximum. Choose a cheaper service.` };
  }
  return { ok: true as const };
}

export function dailySpendAllowed(committedCents: number, dailyMaxCents: number) {
  if (!Number.isInteger(committedCents) || committedCents < 0 || committedCents > dailyMaxCents) {
    return { ok: false as const, message: `That label would exceed the ${formatCents(dailyMaxCents)} daily shipping limit.` };
  }
  return { ok: true as const };
}

export function clearAttemptAllowed(orderNumber: string, typedOrderNumber: string, confirmed: boolean) {
  if (!confirmed || typedOrderNumber.trim() !== orderNumber) {
    return { ok: false as const, message: "Type the order number and confirm you checked Shippo before clearing this attempt." };
  }
  return { ok: true as const };
}

export function classifyTransaction(transaction: { status?: string; object_id?: string } | null | undefined) {
  const status = transaction?.status?.toUpperCase() ?? "";
  if (status === "SUCCESS" && transaction?.object_id) return "succeeded" as const;
  if (status === "ERROR") return "failed" as const;
  return "uncertain" as const;
}

export function classifyPurchaseError(error: { status?: number; code?: string } | null) {
  if (!error || typeof error.status !== "number") return "uncertain" as const;
  if (error.code === "label_uncertain" || error.code === "carrier_timeout") return "uncertain" as const;
  if (error.status === 409 || error.status >= 500 || error.status === 408 || error.status === 429) return "uncertain" as const;
  if (error.status >= 400 && error.status < 500) return "failed" as const;
  return "uncertain" as const;
}

function nextCalendarDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
}

function zonedMidnightUtc(day: string, timeZone: string) {
  let utc = Date.parse(`${day}T00:00:00Z`);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = wallTime(new Date(utc), timeZone);
    const delta = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${local}Z`);
    if (delta === 0) break;
    utc += delta;
  }
  return utc;
}

function wallTime(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = value("hour") === "24" ? "00" : value("hour");
  return `${value("year")}-${value("month")}-${value("day")}T${hour}:${value("minute")}:${value("second")}`;
}
