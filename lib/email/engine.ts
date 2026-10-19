import { desc, eq } from "drizzle-orm";
import { ensureCommerceSchema } from "../../db/migrate.ts";
import { getDb } from "../../db/index.ts";
import { announcementEvents, campaigns, emailEvents, marketingSettings, subscribers } from "../../db/schema.ts";
import { getCharacter, macropadPurchasable, shopProducts, type MacropadLaunchState } from "../catalog.ts";
import { commerceEnv } from "../commerce/env.ts";
import { formatCents } from "../commerce/money.ts";
import { readAnnouncement, singleAnnouncement, type AnnouncementContent } from "./announcement.ts";
import { sendCampaign, syncSubscriberTopics } from "./newsletter.ts";
import { isUniqueError } from "./policy.ts";
import {
  absolutePublicUrl,
  announcementFrame,
  defaultAutomations,
  digestDelivery,
  intakeAction,
  isEventKind,
  isTopic,
  parseAutomations,
  parsePreferences,
  productNotices,
  utcDay,
  type AutomationMode,
  type EventKind,
} from "./topics.ts";

export type AnnouncementInput = {
  kind: EventKind;
  dedupeKey: string;
  title: string;
  summary: string;
  linkUrl: string;
  imageUrl?: string;
  priceLabel?: string;
  ctaLabel?: string;
  force?: "draft" | "digest";
};

export async function loadAutomations() {
  await ensureCommerceSchema();
  const [row] = await getDb().select().from(marketingSettings).where(eq(marketingSettings.id, "automations"));
  return parseAutomations(row?.configJson);
}

export async function saveAutomations(value: Record<string, string | undefined>) {
  const current = defaultAutomations();
  for (const key of Object.keys(current) as (keyof typeof current)[]) {
    const mode = value[key];
    if (mode === "draft" || mode === "digest" || mode === "auto") current[key] = mode;
  }
  await ensureCommerceSchema();
  const now = new Date().toISOString();
  await getDb().insert(marketingSettings).values({
    id: "automations",
    configJson: JSON.stringify(current),
    updatedAt: now,
  }).onConflictDoUpdate({
    target: marketingSettings.id,
    set: { configJson: JSON.stringify(current), updatedAt: now },
  });
  return current;
}

export async function ingestAnnouncement(input: AnnouncementInput, when = new Date()) {
  const title = input.title.trim().slice(0, 140);
  const summary = input.summary.trim().slice(0, 800);
  const linkUrl = absolutePublicUrl(input.linkUrl, commerceEnv().publicSiteUrl);
  if (!isEventKind(input.kind) || title.length < 3 || summary.length < 3 || !linkUrl) {
    return { ok: false as const, message: "Add a title, a short description, and a link on shopkapo.com or https." };
  }
  const imageUrl = input.imageUrl ? absolutePublicUrl(input.imageUrl, commerceEnv().publicSiteUrl) : undefined;
  if (input.imageUrl && !imageUrl) return { ok: false as const, message: "Use a KAPO image path or an https image." };
  await ensureCommerceSchema();
  const automations = await loadAutomations();
  const mode: AutomationMode = input.force ?? automations[input.kind];
  const action = intakeAction(mode);
  const frame = announcementFrame(input.kind);
  const now = when.toISOString();
  try {
    await getDb().insert(announcementEvents).values({
      id: crypto.randomUUID(),
      dedupeKey: input.dedupeKey.slice(0, 180),
      kind: input.kind,
      topic: frame.topic,
      title,
      summary,
      imageUrl: imageUrl ?? null,
      linkUrl,
      priceLabel: input.priceLabel?.slice(0, 40) ?? null,
      status: action === "queue" ? "queued" : "drafted",
      campaignId: null,
      createdAt: now,
    });
  } catch (error) {
    if (isUniqueError(error)) return { ok: true as const, duplicate: true, message: "That announcement was already created." };
    throw error;
  }
  const draft = {
    ...input,
    title,
    summary,
    linkUrl,
    imageUrl: imageUrl ?? undefined,
  };
  if (action === "queue") {
    await fanoutImmediate(draft, when);
    return { ok: true as const, queued: true, message: "Added to the weekly digest." };
  }
  const campaignId = await insertCampaign(draft, { audience: "all", when });
  await getDb().update(announcementEvents).set({ campaignId, status: "drafted" }).where(eq(announcementEvents.dedupeKey, input.dedupeKey));
  if (action === "send") {
    const sent = await sendCampaign(campaignId);
    return sent.ok
      ? { ok: true as const, id: campaignId, sent: true }
      : { ok: false as const, message: sent.message };
  }
  return { ok: true as const, id: campaignId, draft: true };
}

export async function buildWeeklyDigest(options?: { force?: boolean; when?: Date }) {
  await ensureCommerceSchema();
  const when = options?.when ?? new Date();
  const queued = await getDb().select().from(announcementEvents).where(eq(announcementEvents.status, "queued"));
  if (queued.length === 0) return { ok: false as const, message: "Nothing is waiting for the weekly digest." };
  if (!options?.force) {
    const recent = await getDb().select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(30);
    const fresh = recent.find((campaign) => campaign.kind === "digest" && campaign.sentAt && when.getTime() - Date.parse(campaign.sentAt) < 6 * 24 * 60 * 60 * 1000);
    if (fresh) return { ok: false as const, message: "A weekly digest already went out in the last six days." };
  }
  const content = digestContent(queued, when);
  const topics = [...new Set(queued.map((event) => event.topic).filter(isTopic))];
  const campaignId = crypto.randomUUID();
  const now = when.toISOString();
  await getDb().insert(campaigns).values({
    id: campaignId,
    subject: content.subject,
    preheader: content.preheader,
    bodyText: content.intro,
    status: "draft",
    scheduledAt: null,
    sentAt: null,
    resendBroadcastId: null,
    kind: "digest",
    topic: "news",
    audience: "weekly",
    topicsJson: JSON.stringify(topics),
    blocksJson: JSON.stringify(content),
    eventKey: `digest:${utcDay(when)}`,
    skippedCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  for (const event of queued) {
    await getDb().update(announcementEvents).set({ status: "drafted", campaignId }).where(eq(announcementEvents.id, event.id));
  }
  const delivery = digestDelivery((await loadAutomations()).weekly_digest);
  if (delivery === "send") {
    const sent = await sendCampaign(campaignId);
    return sent.ok ? { ok: true as const, id: campaignId, sent: true } : { ok: false as const, message: sent.message };
  }
  return { ok: true as const, id: campaignId, draft: true };
}

export async function savePreferenceSelection(token: string, value: Record<string, unknown>) {
  if (!token || token.length > 80) return { ok: false as const, message: "This preferences link is not valid." };
  await ensureCommerceSchema();
  const [row] = await getDb().select().from(subscribers).where(eq(subscribers.unsubscribeToken, token));
  if (!row) return { ok: false as const, message: "This preferences link is not valid." };
  if (row.status === "pending") return { ok: false as const, message: "Confirm the KAPO email first, then choose what you want." };
  if (row.status === "unsubscribed") return { ok: false as const, message: "This address is unsubscribed. Sign up again from the site to rejoin." };
  const current = parsePreferences(row.preferencesJson);
  for (const topic of ["products", "deals", "youtube", "instagram", "news"] as const) {
    if (typeof value[topic] === "boolean") current[topic] = value[topic];
  }
  if (value.frequency === "weekly" || value.frequency === "immediate") current.frequency = value.frequency;
  const now = new Date().toISOString();
  await getDb().update(subscribers).set({ preferencesJson: JSON.stringify(current), updatedAt: now }).where(eq(subscribers.id, row.id));
  await syncSubscriberTopics(row.email, false, current);
  return { ok: true as const, preferences: current };
}

export async function preferenceView(token: string) {
  if (!token || token.length > 80) return null;
  await ensureCommerceSchema();
  const [row] = await getDb().select().from(subscribers).where(eq(subscribers.unsubscribeToken, token));
  if (!row) return null;
  return {
    status: row.status,
    preferences: parsePreferences(row.preferencesJson),
  };
}

export async function recordProductChange(input: {
  id: string;
  name: string;
  image: string;
  href: string;
  summary: string;
  before: { available: boolean; priceCents: number | null };
  after: { available: boolean; priceCents: number | null };
}) {
  await ensureCommerceSchema();
  const origin = commerceEnv().publicSiteUrl;
  const launchKey = `product:${input.id}:launch`;
  const [launch] = await getDb().select().from(announcementEvents).where(eq(announcementEvents.dedupeKey, launchKey));
  const notices = productNotices({
    id: input.id,
    before: input.before,
    after: input.after,
    launchAnnounced: Boolean(launch),
    day: utcDay(),
  });
  const linkUrl = absolutePublicUrl(input.href, origin) ?? input.href;
  const imageUrl = absolutePublicUrl(input.image, origin) ?? undefined;
  const results = [];
  for (const notice of notices) {
    const priceLabel = input.after.priceCents ? formatCents(input.after.priceCents) : undefined;
    const title = notice.kind === "product_restocked"
      ? `${input.name} is back.`
      : notice.kind === "promotion"
        ? `${input.name} is ${priceLabel ?? "lower"}.`
        : input.name;
    const summary = notice.kind === "promotion"
      ? `${input.name} dropped in price. ${input.summary}`
      : notice.kind === "product_restocked"
        ? `${input.name} is available to order again. ${input.summary}`
        : input.summary;
    results.push(await ingestAnnouncement({
      kind: notice.kind,
      dedupeKey: notice.dedupeKey,
      title,
      summary,
      linkUrl,
      imageUrl,
      priceLabel,
    }));
  }
  return results;
}

export async function recordMacropadChange(before: MacropadLaunchState, after: MacropadLaunchState) {
  return recordProductChange({
    id: "macropad-bare",
    name: "KAPO Pad",
    image: "/products/macropad-white-bare.png",
    href: "/macropad",
    summary: "The six-key KAPO Pad is available to order.",
    before: { available: macropadPurchasable(before), priceCents: before.priceCents },
    after: { available: macropadPurchasable(after), priceCents: after.priceCents },
  });
}

export async function announceCatalogProduct(productId: string, kind: "product_published" | "product_restocked", force?: "draft" | "digest") {
  const product = shopProducts.find((item) => item.id === productId);
  if (!product) return { ok: false as const, message: "That product is not in the KAPO shop." };
  const character = getCharacter(productId.split("-")[0] ?? "");
  const priceCents = product.price === null ? null : Math.round(product.price * 100);
  const day = utcDay();
  const dedupeKey = kind === "product_published" ? `product:${product.id}:launch` : `product:${product.id}:restock:${day}`;
  const name = product.category === "macropads" ? product.name : `${product.name} ${product.style}`;
  return ingestAnnouncement({
    kind,
    dedupeKey,
    title: name,
    summary: character?.shortStory ?? `${name} is ready in the KAPO shop.`,
    linkUrl: product.href,
    imageUrl: product.image,
    priceLabel: priceCents ? formatCents(priceCents) : undefined,
    force,
  });
}

export async function marketingOverview() {
  await ensureCommerceSchema();
  const db = getDb();
  const [people, campaignRows, events, queued, eventCounts] = await Promise.all([
    db.select().from(subscribers),
    db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(40),
    db.select().from(emailEvents),
    db.select().from(announcementEvents).where(eq(announcementEvents.status, "queued")).orderBy(desc(announcementEvents.createdAt)),
    db.select().from(announcementEvents).orderBy(desc(announcementEvents.createdAt)).limit(20),
  ]);
  const confirmed = people.filter((person) => person.status === "confirmed");
  const preferences = confirmed.map((person) => parsePreferences(person.preferencesJson));
  const countTopic = (topic: "products" | "deals" | "youtube" | "instagram" | "news") => preferences.filter((item) => item[topic]).length;
  const settings = commerceEnv();
  return {
    subscribers: {
      confirmed: confirmed.length,
      pending: people.filter((person) => person.status === "pending").length,
      unsubscribed: people.filter((person) => person.status === "unsubscribed").length,
      weekly: preferences.filter((item) => item.frequency === "weekly").length,
      immediate: preferences.filter((item) => item.frequency === "immediate").length,
    },
    topics: {
      products: countTopic("products"),
      deals: countTopic("deals"),
      youtube: countTopic("youtube"),
      instagram: countTopic("instagram"),
      news: countTopic("news"),
    },
    people: people.slice(0, 80).map((person) => ({
      id: person.id,
      email: person.email,
      status: person.status,
      source: person.source,
      preferences: parsePreferences(person.preferencesJson),
      createdAt: person.createdAt,
    })),
    campaigns: campaignRows,
    queued,
    recentEvents: eventCounts,
    automations: await loadAutomations(),
    opened: events.filter((event) => event.type === "email.opened").length,
    clicked: events.filter((event) => event.type === "email.clicked").length,
    delivered: events.filter((event) => event.type === "email.delivered").length,
    bounced: events.filter((event) => event.type === "email.bounced").length,
    complaints: events.filter((event) => event.type === "email.complained").length,
    mailingAddressConfigured: Boolean(settings.mailingAddress.trim()),
    topicsConfigured: Boolean(settings.resendTopicProducts || settings.resendTopicDeals || settings.resendTopicYoutube || settings.resendTopicInstagram || settings.resendTopicNews),
    youtubeConfigured: Boolean(settings.youtubeChannelId),
    instagramManual: true,
  };
}

async function fanoutImmediate(input: AnnouncementInput, when: Date) {
  const confirmed = await getDb().select().from(subscribers).where(eq(subscribers.status, "confirmed"));
  const topic = announcementFrame(input.kind).topic;
  const wantsNow = confirmed.some((person) => {
    const preferences = parsePreferences(person.preferencesJson);
    return preferences.frequency === "immediate" && preferences[topic];
  });
  if (!wantsNow) return;
  await insertCampaign(input, { audience: "immediate", when, send: true });
}

async function insertCampaign(input: AnnouncementInput, options: { audience: "all" | "weekly" | "immediate"; when: Date; send?: boolean }) {
  const content = singleAnnouncement({ ...input, when: options.when });
  const frame = announcementFrame(input.kind);
  const campaignId = crypto.randomUUID();
  const now = options.when.toISOString();
  await getDb().insert(campaigns).values({
    id: campaignId,
    subject: content.subject,
    preheader: content.preheader,
    bodyText: content.blocks.map((block) => `${block.title}\n${block.body}`).join("\n\n"),
    status: "draft",
    scheduledAt: null,
    sentAt: null,
    resendBroadcastId: null,
    kind: input.kind,
    topic: frame.topic,
    audience: options.audience,
    topicsJson: JSON.stringify([frame.topic]),
    blocksJson: JSON.stringify(content),
    eventKey: options.audience === "immediate" ? `${input.dedupeKey}:immediate` : input.dedupeKey,
    skippedCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  if (options.send) await sendCampaign(campaignId);
  return campaignId;
}

function digestContent(events: { kind: string; title: string; summary: string; linkUrl: string; imageUrl: string | null; priceLabel: string | null }[], when: Date): AnnouncementContent {
  const content = singleAnnouncement({
    kind: "digest",
    title: "This week at KAPO",
    summary: "Fresh characters, creative ideas, and a peek at what's happening behind the scenes.",
    linkUrl: events[0]?.linkUrl ?? commerceEnv().publicSiteUrl,
    when,
  });
  content.blocks = events.slice(0, 8).map((event) => ({
    imageUrl: event.imageUrl ?? undefined,
    title: event.title,
    body: event.summary,
    priceLabel: event.priceLabel ?? undefined,
    ctaLabel: announcementFrame(event.kind).cta,
    ctaUrl: event.linkUrl,
  }));
  return content;
}

export async function saveComposedCampaign(input: {
  id?: string;
  subject: string;
  preheader: string;
  headline: string;
  intro: string;
  kicker: string;
  blockTitle: string;
  blockBody: string;
  blockImage: string;
  blockUrl: string;
  blockCta: string;
  blockPrice: string;
  kind: string;
}) {
  const origin = commerceEnv().publicSiteUrl;
  const linkUrl = absolutePublicUrl(input.blockUrl || "/shop", origin);
  const imageUrl = input.blockImage ? absolutePublicUrl(input.blockImage, origin) : undefined;
  if (!linkUrl || input.subject.trim().length < 3 || input.headline.trim().length < 3 || input.blockBody.trim().length < 3) {
    return { ok: false as const, message: "Add a subject, headline, description, and link." };
  }
  if (input.blockImage && !imageUrl) return { ok: false as const, message: "Use a KAPO image path or an https image." };
  const kind = isEventKind(input.kind) ? input.kind : "news";
  const frame = announcementFrame(kind);
  const content = singleAnnouncement({
    kind,
    title: input.blockTitle.trim() || input.headline.trim(),
    summary: input.blockBody.trim(),
    linkUrl,
    imageUrl: imageUrl ?? undefined,
    priceLabel: input.blockPrice.trim() || undefined,
    ctaLabel: input.blockCta.trim() || frame.cta,
  });
  content.subject = input.subject.trim().slice(0, 140);
  content.preheader = input.preheader.trim().slice(0, 180) || content.preheader;
  content.headline = input.headline.trim().slice(0, 140);
  content.intro = input.intro.trim().slice(0, 500) || content.intro;
  content.kicker = input.kicker.trim().slice(0, 40) || frame.kicker;
  await ensureCommerceSchema();
  const now = new Date().toISOString();
  const values = {
    subject: content.subject,
    preheader: content.preheader,
    bodyText: `${content.headline}\n\n${input.blockBody.trim()}`,
    blocksJson: JSON.stringify(content),
    kind,
    topic: frame.topic,
    topicsJson: JSON.stringify([frame.topic]),
    updatedAt: now,
  };
  if (input.id) {
    const [existing] = await getDb().select().from(campaigns).where(eq(campaigns.id, input.id));
    if (!existing) return { ok: false as const, message: "That campaign was not found." };
    if (existing.status === "sent" || existing.status === "sending") return { ok: false as const, message: "A sent campaign cannot be edited." };
    await getDb().update(campaigns).set(values).where(eq(campaigns.id, input.id));
    return { ok: true as const, id: input.id };
  }
  const id = crypto.randomUUID();
  await getDb().insert(campaigns).values({
    id,
    ...values,
    status: "draft",
    scheduledAt: null,
    sentAt: null,
    resendBroadcastId: null,
    audience: "all",
    eventKey: `manual:${id}`,
    skippedCount: 0,
    createdAt: now,
  });
  return { ok: true as const, id };
}

export function renderStoredCampaign(blocksJson: string | null | undefined) {
  return readAnnouncement(blocksJson);
}
