export const ROUTINE_WEEKLY_CAP = 2;
export const ROUTINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const PRICE_DROP_RATIO = 0.1;

export const TOPICS = [
  { id: "products", label: "New products & restocks", detail: "New characters, releases and availability" },
  { id: "deals", label: "Deals & price drops", detail: "Discount codes, bundles and special offers" },
  { id: "youtube", label: "YouTube uploads", detail: "New videos, Shorts and behind-the-scenes content" },
  { id: "instagram", label: "Instagram posts & Reels", detail: "Character reveals, renders and new posts" },
  { id: "news", label: "KAPO news", detail: "Design progress, announcements and company updates" },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];
export type Frequency = "weekly" | "immediate";
export type Preferences = Record<TopicId, boolean> & { frequency: Frequency };

export const AUTOMATIONS = [
  { id: "product_published", label: "New product published", suggestion: "Prepare draft — requires my approval" },
  { id: "product_restocked", label: "Product restocked", suggestion: "Prepare draft — requires my approval" },
  { id: "promotion", label: "Promotion or price drop", suggestion: "Prepare draft — requires my approval" },
  { id: "youtube", label: "New YouTube video or Short", suggestion: "Add to weekly digest" },
  { id: "instagram", label: "New Instagram post or Reel", suggestion: "Add to weekly digest" },
  { id: "news", label: "KAPO news and behind the scenes", suggestion: "Add to weekly digest" },
  { id: "weekly_digest", label: "Weekly KAPO digest", suggestion: "Send automatically" },
] as const;

export type AutomationId = (typeof AUTOMATIONS)[number]["id"];
export type AutomationMode = "draft" | "digest" | "auto";
export type EventKind = "product_published" | "product_restocked" | "promotion" | "youtube" | "instagram" | "news";

const EVENT_KINDS: EventKind[] = ["product_published", "product_restocked", "promotion", "youtube", "instagram", "news"];

export function defaultPreferences(): Preferences {
  return { products: true, deals: true, youtube: true, instagram: true, news: true, frequency: "weekly" };
}

export function parsePreferences(value: string | null | undefined): Preferences {
  const preferences = defaultPreferences();
  if (!value) return preferences;
  try {
    const parsed = JSON.parse(value) as Partial<Preferences>;
    for (const topic of TOPICS) {
      const choice = parsed[topic.id];
      if (typeof choice === "boolean") preferences[topic.id] = choice;
    }
    if (parsed.frequency === "immediate" || parsed.frequency === "weekly") preferences.frequency = parsed.frequency;
  } catch {
    return defaultPreferences();
  }
  return preferences;
}

export function defaultAutomations(): Record<AutomationId, AutomationMode> {
  return {
    product_published: "draft",
    product_restocked: "draft",
    promotion: "draft",
    youtube: "digest",
    instagram: "digest",
    news: "digest",
    weekly_digest: "auto",
  };
}

export function parseAutomations(value: string | null | undefined) {
  const automations = defaultAutomations();
  if (!value) return automations;
  try {
    const parsed = JSON.parse(value) as Partial<Record<AutomationId, AutomationMode>>;
    for (const item of AUTOMATIONS) {
      const mode = parsed[item.id];
      if (mode === "draft" || mode === "digest" || mode === "auto") automations[item.id] = mode;
    }
  } catch {
    return defaultAutomations();
  }
  return automations;
}

export function isEventKind(value: string): value is EventKind {
  return EVENT_KINDS.includes(value as EventKind);
}

export function isTopic(value: string): value is TopicId {
  return TOPICS.some((topic) => topic.id === value);
}

export function announcementFrame(kind: string) {
  switch (kind) {
    case "product_published":
      return { kicker: "NEW FROM KAPO", cta: "Shop Now", topic: "products" as const };
    case "product_restocked":
      return { kicker: "BACK IN STOCK", cta: "Shop Now", topic: "products" as const };
    case "promotion":
      return { kicker: "A KAPO OFFER", cta: "Shop the offer", topic: "deals" as const };
    case "youtube":
      return { kicker: "ON YOUTUBE", cta: "Watch on YouTube", topic: "youtube" as const };
    case "instagram":
      return { kicker: "ON INSTAGRAM", cta: "See the post", topic: "instagram" as const };
    case "digest":
      return { kicker: "THIS WEEK", cta: "Open", topic: "news" as const };
    default:
      return { kicker: "KAPO NEWS", cta: "Read more", topic: "news" as const };
  }
}

export function intakeAction(mode: AutomationMode) {
  if (mode === "draft") return "draft" as const;
  if (mode === "auto") return "send" as const;
  return "queue" as const;
}

export function digestDelivery(mode: AutomationMode) {
  return mode === "auto" ? "send" as const : "draft" as const;
}

export function substantialPriceDrop(before: number | null, after: number | null) {
  if (before === null || after === null || before < 1 || after >= before) return false;
  return (before - after) / before >= PRICE_DROP_RATIO;
}

export function productNotices(input: {
  id: string;
  before: { available: boolean; priceCents: number | null };
  after: { available: boolean; priceCents: number | null };
  launchAnnounced: boolean;
  day: string;
}) {
  const notices: { kind: EventKind; dedupeKey: string }[] = [];
  const becameAvailable = !input.before.available && input.after.available;
  if (becameAvailable && !input.launchAnnounced) {
    notices.push({ kind: "product_published", dedupeKey: `product:${input.id}:launch` });
    return notices;
  }
  if (becameAvailable && input.launchAnnounced) {
    notices.push({ kind: "product_restocked", dedupeKey: `product:${input.id}:restock:${input.day}` });
    return notices;
  }
  if (input.before.available && input.after.available && substantialPriceDrop(input.before.priceCents, input.after.priceCents)) {
    notices.push({ kind: "promotion", dedupeKey: `product:${input.id}:price:${input.after.priceCents}` });
  }
  return notices;
}

export function subscriberFitsCampaign(input: {
  status: string;
  preferences: Preferences;
  kind: string;
  topic: string;
  topics: string[];
  audience: string;
  routineSends: number;
}) {
  if (input.status !== "confirmed") return { ok: false as const, reason: "unconfirmed" as const };
  const topics = input.kind === "digest" ? input.topics : [input.topic];
  if (!topics.some((topic) => isTopic(topic) && input.preferences[topic])) {
    return { ok: false as const, reason: "topic_off" as const };
  }
  if (input.audience === "weekly" && input.preferences.frequency !== "weekly") {
    return { ok: false as const, reason: "frequency" as const };
  }
  if (input.audience === "immediate" && input.preferences.frequency !== "immediate") {
    return { ok: false as const, reason: "frequency" as const };
  }
  const exempt = input.kind === "product_published" || input.preferences.frequency === "immediate";
  if (!exempt && input.routineSends >= ROUTINE_WEEKLY_CAP) return { ok: false as const, reason: "cap" as const };
  return { ok: true as const, reason: "ok" as const };
}

export function deliveryMode(input: { audience: string; topicConfigured: boolean; capped: number; recipientCount: number }) {
  if (input.recipientCount < 1) return "empty" as const;
  if (input.audience === "all" && input.topicConfigured && input.capped === 0) return "broadcast" as const;
  if (input.recipientCount > 500) return "too_many" as const;
  return "direct" as const;
}

export function editionLabel(date: Date) {
  const month = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" }).toUpperCase();
  return `THE KAPO CLUB · ${month} EDITION`;
}

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function announcementSlug(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return slug || "update";
}

export function absolutePublicUrl(value: string, origin: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return `${origin}${trimmed}`;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    const local = host === "localhost" || host === "127.0.0.1";
    if (url.protocol === "https:" || (url.protocol === "http:" && local)) return url.toString();
  } catch {
    return null;
  }
  return null;
}
