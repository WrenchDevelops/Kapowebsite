import { moneyStringToCents } from "./money.ts";

export type ShippingTier = "normal" | "fast" | "super_fast";

export type ShippingRate = {
  id: string;
  provider: string;
  serviceName: string;
  serviceToken: string;
  carrierAmountCents: number;
  amountCents: number;
  currency: string;
  estimatedDays: number | null;
  durationTerms: string;
  attributes: string[];
  tier?: ShippingTier;
  tierLabel?: string;
  shippoRateId?: string;
  detail?: string;
};

const UNTRACKED_TOKENS = new Set([
  "usps_first",
  "usps_first_class_mail",
  "usps_media_mail",
  "usps_library_mail",
]);

type RawRate = {
  object_id?: string;
  amount?: string;
  currency?: string;
  provider?: string;
  estimated_days?: number | null;
  duration_terms?: string;
  attributes?: string[];
  servicelevel?: { name?: string; token?: string };
};

export function normalizeRates(rates: RawRate[], handlingFeeCents: number): ShippingRate[] {
  const normalized: ShippingRate[] = [];
  for (const rate of rates) {
    const token = rate.servicelevel?.token?.toLowerCase() ?? "";
    const provider = rate.provider?.trim() ?? "";
    const amountCents = rate.amount ? moneyStringToCents(rate.amount) : null;
    if (!rate.object_id || !provider || !rate.servicelevel?.name || amountCents === null) continue;
    if ((rate.currency ?? "").toUpperCase() !== "USD") continue;
    if (!token || UNTRACKED_TOKENS.has(token) || token.includes("letter") || token.includes("pickup")) continue;
    normalized.push({
      id: rate.object_id,
      provider,
      serviceName: rate.servicelevel.name,
      serviceToken: token,
      carrierAmountCents: amountCents,
      amountCents: amountCents + Math.max(0, handlingFeeCents),
      currency: "usd",
      estimatedDays: Number.isFinite(rate.estimated_days) ? Number(rate.estimated_days) : null,
      durationTerms: rate.duration_terms?.trim() || "",
      attributes: rate.attributes ?? [],
    });
  }
  return normalized.sort((left, right) => left.amountCents - right.amountCents || (left.estimatedDays ?? 99) - (right.estimatedDays ?? 99) || left.provider.localeCompare(right.provider));
}

const OVERNIGHT_CAP_CENTS = 1999;

function transitDays(rate: ShippingRate) {
  return rate.estimatedDays === null || rate.estimatedDays < 0 ? null : rate.estimatedDays;
}

type ServiceSpeed = { rank: number; days: number; label: string };

function serviceSpeed(rate: ShippingRate): ServiceSpeed {
  const token = rate.serviceToken;
  const name = rate.serviceName.toLowerCase();
  if (/next_day|overnight|early_am|priority_express/.test(token) || /next day|overnight|priority mail express/.test(name)) {
    return { rank: 1, days: 1, label: "1 business day" };
  }
  if (/second_day|2nd_day|two_day/.test(token) || /2nd day|second day/.test(name)) {
    return { rank: 2, days: 2, label: "2 business days" };
  }
  if (/3_day|three_day/.test(token) || /3 day/.test(name)) {
    return { rank: 3, days: 3, label: "3 business days" };
  }
  if (token.includes("priority") && !token.includes("express")) {
    const days = transitDays(rate) ?? 3;
    return { rank: days <= 2 ? 2 : 3, days, label: dayLabel(days) };
  }
  const range = rate.durationTerms.match(/(\d+)\s*(?:to|-|–)\s*(\d+)/);
  const estimate = transitDays(rate);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (estimate === null || max > estimate) return { rank: 4, days: max, label: `${min}–${max} business days` };
  }
  const days = estimate ?? 5;
  return { rank: 4, days, label: dayLabel(days) };
}

function dayLabel(days: number) {
  return `${days} business day${days === 1 ? "" : "s"}`;
}

type Rated = { rate: ShippingRate; speed: ServiceSpeed };

function byPrice(left: Rated, right: Rated) {
  return left.rate.amountCents - right.rate.amountCents;
}

export function customerShippingOptions(rates: ShippingRate[]): ShippingRate[] {
  if (!rates.length) return [];
  const rated = rates.map((rate) => ({ rate, speed: serviceSpeed(rate) }));
  const normal = rated.filter((entry) => entry.speed.rank === 4).sort(byPrice)[0] ?? [...rated].sort(byPrice)[0];
  const overnight = rated
    .filter((entry) => entry.speed.rank === 1 && entry.rate.amountCents <= OVERNIGHT_CAP_CENTS)
    .sort(byPrice)[0];
  const quicker = rated
    .filter((entry) => entry.rate.id !== normal.rate.id && entry.speed.rank < normal.speed.rank && entry.speed.rank > 1)
    .sort((left, right) => left.speed.days - right.speed.days || left.rate.amountCents - right.rate.amountCents);
  const superChoice = overnight ?? quicker[0];
  const fastChoice = (superChoice
    ? quicker.filter((entry) => entry.speed.days > superChoice.speed.days).sort(byPrice)[0]
    : undefined) ?? quicker.find((entry) => entry.rate.id !== superChoice?.rate.id);
  const chosen = [normal, fastChoice, superChoice].filter((entry): entry is Rated => Boolean(entry));
  const unique = chosen.filter((entry, index) => chosen.findIndex((other) => other.rate.id === entry.rate.id) === index);
  const tiers: { id: ShippingTier; label: string }[] = unique.length === 3
    ? [{ id: "normal", label: "Normal" }, { id: "fast", label: "Fast" }, { id: "super_fast", label: "Super fast" }]
    : unique.length === 2
      ? [{ id: "normal", label: "Normal" }, { id: "fast", label: "Fast" }]
      : [{ id: "normal", label: "Normal" }];
  return unique.map((entry, index) => present(entry, tiers[index]));
}

function present(entry: Rated, tier: { id: ShippingTier; label: string }): ShippingRate {
  return {
    ...entry.rate,
    id: `${entry.rate.id}:${tier.id}`,
    shippoRateId: entry.rate.id,
    estimatedDays: entry.speed.days,
    tier: tier.id,
    tierLabel: tier.label,
    detail: `${entry.rate.provider} ${entry.rate.serviceName} · ${entry.speed.label}`,
  };
}

export function cheapestRate(rates: ShippingRate[]) {
  return [...rates].sort((left, right) => left.amountCents - right.amountCents)[0] ?? null;
}

export function findRate(rates: ShippingRate[], rateId: string) {
  return rates.find((rate) => rate.id === rateId) ?? null;
}

export function quoteExpiry(now: Date, ttlSeconds: number) {
  const ttl = Number.isFinite(ttlSeconds) ? Math.min(86400, Math.max(60, ttlSeconds)) : 1800;
  return new Date(now.getTime() + ttl * 1000).toISOString();
}

export function isQuoteExpired(expiresAt: string, now: Date) {
  const time = Date.parse(expiresAt);
  return !Number.isFinite(time) || time <= now.getTime();
}

export function carrierAmountCents(rate: ShippingRate, handlingFeeCents: number) {
  return Math.max(0, rate.amountCents - Math.max(0, handlingFeeCents));
}
