import { and, desc, eq, isNull } from "drizzle-orm";
import { ensureCommerceSchema } from "../../db/migrate.ts";
import { getDb } from "../../db/index.ts";
import { announcementEvents, campaignRecipients, campaigns, emailEvents, marketingSends, notifications, subscribers, supportRequests } from "../../db/schema.ts";
import { commerceEnv } from "../commerce/env.ts";
import { isEmailAddress, publicSiteUrl, sender } from "./addresses.ts";
import { readAnnouncement, renderAnnouncementEmail } from "./announcement.ts";
import { characters, type CharacterSlug } from "../catalog.ts";
import { renderBackInStockEmail, renderLaunchEmail } from "./messages.ts";
import { sendResendEmail } from "./client.ts";
import { marketingLinks, renderMarketingEmail, splitParagraphs } from "./marketing.ts";
import { campaignSendBlock, isUniqueError, subscriptionPlan } from "./policy.ts";
import { resendTopicId, topicSubscriptions } from "./resend-topics.ts";
import { defaultPreferences, deliveryMode, parsePreferences, ROUTINE_WINDOW_MS, subscriberFitsCampaign, type Preferences } from "./topics.ts";
import { notificationStatusForEvent } from "./webhook.ts";

const CONFIRM_SUBJECT = "Confirm your KAPO newsletter";

export async function subscribeEmail(input: { email: string; consent: boolean; source: string }) {
  const email = input.email.trim().toLowerCase();
  if (!isEmailAddress(email)) return { ok: false as const, message: "Enter a valid email address." };
  await ensureCommerceSchema();
  const db = getDb();
  const [existing] = await db.select().from(subscribers).where(eq(subscribers.email, email));
  const plan = subscriptionPlan(existing ?? null, input.consent);
  if (!plan.ok) return { ok: false as const, message: "Check the box to agree to KAPO news." };
  if (plan.action === "already") return { ok: true as const, status: "confirmed" as const };

  const confirmToken = crypto.randomUUID();
  const unsubscribeToken = crypto.randomUUID();
  const now = new Date().toISOString();
  const row = {
    email,
    status: "pending",
    source: input.source.slice(0, 40) || "website",
    consentAt: now,
    confirmedAt: null,
    unsubscribedAt: null,
    welcomeSentAt: null,
    confirmTokenHash: await sha256(confirmToken),
    unsubscribeToken,
    preferencesJson: existing?.preferencesJson ?? JSON.stringify(defaultPreferences()),
    updatedAt: now,
  };
  if (!existing) {
    await db.insert(subscribers).values({ id: crypto.randomUUID(), createdAt: now, ...row });
  } else {
    await db.update(subscribers).set(row).where(eq(subscribers.id, existing.id));
  }

  const settings = commerceEnv();
  const links = marketingLinks(settings.publicSiteUrl, unsubscribeToken);
  const message = renderMarketingEmail({
    subject: CONFIRM_SUBJECT,
    headline: "Confirm your email",
    eyebrow: "KAPO news",
    preheader: "Confirm that you want email from KAPO.",
    paragraphs: [
      "Confirm your email to choose product launches, deals, YouTube, Instagram, and KAPO news.",
      "KAPO will not add you from an order or a support message. This list is only for people who confirm.",
    ],
    ctaLabel: "Confirm KAPO news",
    ctaUrl: links.confirmUrl(confirmToken),
    unsubscribeUrl: links.unsubscribeUrl,
    mailingAddress: settings.mailingAddress || "KAPO has not published a mailing address yet.",
    logoUrl: links.logoUrl,
    character: "kobi",
    characterMode: "compact",
  });
  const sent = await sendResendEmail({
    apiKey: settings.resendKey,
    from: sender("news"),
    to: [email],
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: `newsletter-confirm:${email}:${row.confirmTokenHash.slice(0, 12)}`,
    headers: listHeaders(links.unsubscribeUrl),
  });
  if (!sent.ok) return { ok: false as const, message: "KAPO could not send the confirmation email. Try again in a few minutes." };
  return { ok: true as const, status: "pending" as const };
}

export async function confirmSubscription(token: string) {
  if (!token || token.length > 80) return { ok: false as const, message: "This confirmation link is not valid." };
  await ensureCommerceSchema();
  const db = getDb();
  const [row] = await db.select().from(subscribers).where(eq(subscribers.confirmTokenHash, await sha256(token)));
  if (!row) return { ok: false as const, message: "This confirmation link is not valid." };
  if (row.status === "unsubscribed") return { ok: false as const, message: "This address is unsubscribed. Sign up again from the site if you want KAPO news." };
  const now = new Date().toISOString();
  if (row.status !== "confirmed") {
    await db.update(subscribers).set({ status: "confirmed", confirmedAt: now, updatedAt: now }).where(eq(subscribers.id, row.id));
    await syncAudience(row.email, false);
  }
  if (!row.welcomeSentAt) await sendWelcome(row);
  return { ok: true as const, preferencesUrl: marketingLinks(commerceEnv().publicSiteUrl, row.unsubscribeToken).preferencesUrl };
}

export async function unsubscribeToken(token: string) {
  if (!token || token.length > 80) return { ok: false as const, message: "This unsubscribe link is not valid." };
  await ensureCommerceSchema();
  const [row] = await getDb().select().from(subscribers).where(eq(subscribers.unsubscribeToken, token));
  if (!row) return { ok: false as const, message: "This unsubscribe link is not valid." };
  if (row.status === "unsubscribed") return { ok: true as const, already: true };
  const now = new Date().toISOString();
  await getDb().update(subscribers).set({ status: "unsubscribed", unsubscribedAt: now, updatedAt: now }).where(eq(subscribers.id, row.id));
  await syncAudience(row.email, true);
  return { ok: true as const, already: false };
}

export async function saveCampaign(input: { id?: string; subject: string; preheader: string; body: string; scheduledAt?: string }) {
  const subject = input.subject.trim().slice(0, 140);
  const preheader = input.preheader.trim().slice(0, 180);
  const body = input.body.trim().slice(0, 8000);
  if (subject.length < 3 || splitParagraphs(body).length < 1) {
    return { ok: false as const, message: "Add a subject and a message." };
  }
  await ensureCommerceSchema();
  const now = new Date().toISOString();
  const scheduledAt = input.scheduledAt && !Number.isNaN(Date.parse(input.scheduledAt)) ? new Date(input.scheduledAt).toISOString() : null;
  if (input.id) {
    const [existing] = await getDb().select().from(campaigns).where(eq(campaigns.id, input.id));
    if (!existing) return { ok: false as const, message: "That campaign was not found." };
    if (existing.status === "sent" || existing.status === "sending") return { ok: false as const, message: "A sent campaign cannot be edited." };
    await getDb().update(campaigns).set({
      subject,
      preheader,
      bodyText: body,
      status: scheduledAt ? "scheduled" : "draft",
      scheduledAt,
      updatedAt: now,
    }).where(eq(campaigns.id, input.id));
    return { ok: true as const, id: input.id };
  }
  const id = crypto.randomUUID();
  await getDb().insert(campaigns).values({
    id,
    subject,
    preheader,
    bodyText: body,
    status: scheduledAt ? "scheduled" : "draft",
    scheduledAt,
    sentAt: null,
    resendBroadcastId: null,
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true as const, id };
}

export async function sendCampaign(campaignId: string) {
  await ensureCommerceSchema();
  const db = getDb();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign) return { ok: false as const, message: "That campaign was not found." };
  const settings = commerceEnv();
  const block = campaignSendBlock({
    mailingAddress: settings.mailingAddress,
    confirmedCount: 1,
    status: campaign.status,
  });
  if (block && block.includes("KAPO_MAILING_ADDRESS")) return { ok: false as const, message: block };
  if (campaign.status === "sent") return { ok: false as const, message: "This campaign was already sent." };
  if (!settings.resendKey) return { ok: false as const, message: "Set RESEND_API_KEY before sending." };

  const confirmed = await db.select().from(subscribers).where(eq(subscribers.status, "confirmed"));
  const since = new Date(Date.now() - ROUTINE_WINDOW_MS).toISOString();
  const sends = await db.select().from(marketingSends);
  const recent = new Map<string, number>();
  for (const send of sends) {
    if (send.routine !== 1 || send.sentAt < since) continue;
    recent.set(send.email, (recent.get(send.email) ?? 0) + 1);
  }
  const topics = readTopics(campaign);
  const audience = campaign.audience || "all";
  const kind = campaign.kind || "news";
  let capped = 0;
  const recipients = [];
  for (const person of confirmed) {
    const decision = subscriberFitsCampaign({
      status: person.status,
      preferences: parsePreferences(person.preferencesJson),
      kind,
      topic: campaign.topic || "news",
      topics,
      audience,
      routineSends: recent.get(person.email) ?? 0,
    });
    if (decision.reason === "cap") capped += 1;
    if (decision.ok) recipients.push(person);
  }
  const topicId = resendTopicId(campaign.topic || "news");
  const mode = deliveryMode({
    audience,
    topicConfigured: Boolean(topicId),
    capped,
    recipientCount: recipients.length,
  });
  if (mode === "empty") return { ok: false as const, message: "No confirmed subscriber wants this announcement." };
  if (mode === "too_many") return { ok: false as const, message: "More than 500 matching subscribers. Set the Resend topic id for this announcement so KAPO can send a broadcast." };

  const routine = kind === "product_published" || audience === "immediate" ? 0 : 1;
  const now = new Date().toISOString();
  if (mode === "broadcast") {
    const broadcast = await sendBroadcast(settings.resendKey, settings.resendAudienceId, topicId, campaign, settings.mailingAddress, settings.publicSiteUrl);
    if (!broadcast.ok) return broadcast;
    await db.update(campaigns).set({
      status: "sent",
      sentAt: now,
      resendBroadcastId: broadcast.id,
      skippedCount: capped,
      updatedAt: now,
    }).where(eq(campaigns.id, campaign.id));
    for (const person of recipients) await recordMarketingSend(person.email, campaign.id, campaign.topic || "news", routine, now);
    await db.update(announcementEvents).set({ status: "sent" }).where(eq(announcementEvents.campaignId, campaign.id));
    return { ok: true as const, mode: "broadcast" as const };
  }

  await db.update(campaigns).set({ status: "sending", updatedAt: now }).where(and(eq(campaigns.id, campaign.id), eq(campaigns.status, campaign.status)));
  for (const person of recipients) {
    const sent = await sendOneCampaign(campaign, person.email, settings.mailingAddress, settings.publicSiteUrl, settings.resendKey);
    if (sent) await recordMarketingSend(person.email, campaign.id, campaign.topic || "news", routine, new Date().toISOString());
  }
  const sentAt = new Date().toISOString();
  await db.update(campaigns).set({ status: "sent", sentAt, skippedCount: capped, updatedAt: sentAt }).where(eq(campaigns.id, campaign.id));
  await db.update(announcementEvents).set({ status: "sent" }).where(eq(announcementEvents.campaignId, campaign.id));
  return { ok: true as const, mode: "contacts" as const };
}

export async function sendDueCampaigns(now = new Date()) {
  await ensureCommerceSchema();
  const due = await getDb().select().from(campaigns).where(eq(campaigns.status, "scheduled"));
  const sent: string[] = [];
  for (const campaign of due) {
    if (!campaign.scheduledAt || Date.parse(campaign.scheduledAt) > now.getTime()) continue;
    const result = await sendCampaign(campaign.id);
    if (result.ok) sent.push(campaign.id);
  }
  return sent;
}

export async function applyResendEvent(type: string, resendId: string) {
  const status = notificationStatusForEvent(type);
  const tracked = Boolean(status) || type === "email.opened" || type === "email.clicked";
  if (!tracked || !resendId) return;
  await ensureCommerceSchema();
  const db = getDb();
  const now = new Date().toISOString();
  try {
    await db.insert(emailEvents).values({ id: crypto.randomUUID(), resendId, type, createdAt: now });
  } catch (error) {
    if (!isUniqueError(error)) throw error;
  }
  if (!status) return;
  await db.update(notifications).set({ status, updatedAt: now }).where(eq(notifications.resendId, resendId));
  await db.update(campaignRecipients).set({ status }).where(eq(campaignRecipients.resendId, resendId));
}

export async function applyResendContact(input: { email?: string; unsubscribed?: boolean }) {
  const email = input.email?.trim().toLowerCase() ?? "";
  if (!input.unsubscribed || !isEmailAddress(email)) return;
  await ensureCommerceSchema();
  const now = new Date().toISOString();
  await getDb().update(subscribers).set({ status: "unsubscribed", unsubscribedAt: now, updatedAt: now }).where(eq(subscribers.email, email));
}

export async function emailOverview() {
  await ensureCommerceSchema();
  const db = getDb();
  const [statusRows, notes, events, people, requestRows, campaignRows] = await Promise.all([
    db.select({ status: notifications.status }).from(notifications),
    db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(40),
    db.select({ type: emailEvents.type }).from(emailEvents),
    db.select({ status: subscribers.status }).from(subscribers),
    db.select().from(supportRequests).orderBy(desc(supportRequests.createdAt)).limit(40),
    db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(20),
  ]);
  const countStatus = (status: string) => statusRows.filter((row) => row.status === status).length;
  const eventCount = (type: string) => events.filter((row) => row.type === type).length;
  return {
    sent: statusRows.filter((row) => !["queued", "failed"].includes(row.status)).length,
    delivered: Math.max(countStatus("delivered"), eventCount("email.delivered")),
    bounced: Math.max(countStatus("bounced"), eventCount("email.bounced")),
    complaints: Math.max(countStatus("complained"), eventCount("email.complained")),
    failed: Math.max(countStatus("failed"), eventCount("email.failed")),
    opened: eventCount("email.opened"),
    clicked: eventCount("email.clicked"),
    recent: notes,
    subscribers: {
      confirmed: people.filter((row) => row.status === "confirmed").length,
      pending: people.filter((row) => row.status === "pending").length,
      unsubscribed: people.filter((row) => row.status === "unsubscribed").length,
    },
    requests: requestRows,
    campaigns: campaignRows,
    audienceConfigured: Boolean(commerceEnv().resendAudienceId),
    mailingAddressConfigured: Boolean(commerceEnv().mailingAddress.trim()),
    webhookConfigured: Boolean(commerceEnv().resendWebhookSecret),
  };
}

export async function setSupportResolution(id: string, resolution: "open" | "resolved") {
  await ensureCommerceSchema();
  const now = new Date().toISOString();
  await getDb().update(supportRequests).set({ resolution, updatedAt: now }).where(eq(supportRequests.id, id));
}

async function sendWelcome(row: typeof subscribers.$inferSelect) {
  const settings = commerceEnv();
  if (!settings.mailingAddress.trim() || !settings.resendKey) return;
  const links = marketingLinks(settings.publicSiteUrl, row.unsubscribeToken);
  const message = renderMarketingEmail({
    subject: "Welcome to KAPO",
    headline: "You're on the list",
    eyebrow: "Welcome",
    preheader: "You're confirmed for KAPO news.",
    paragraphs: [
      "You're confirmed. Product launches and promotions go out when they happen. YouTube, Instagram, and studio notes wait for the weekly digest unless you ask for every post.",
      "Orders and support replies stay off this list. You can change this any time.",
    ],
    ctaLabel: "Choose what you get",
    ctaUrl: links.preferencesUrl,
    preferencesUrl: links.preferencesUrl,
    unsubscribeUrl: links.unsubscribeUrl,
    mailingAddress: settings.mailingAddress,
    logoUrl: links.logoUrl,
    character: "kobi",
    characterMode: "hero",
  });
  const sent = await sendResendEmail({
    apiKey: settings.resendKey,
    from: sender("news"),
    to: [row.email],
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: `newsletter-welcome:${row.id}`,
    headers: listHeaders(links.unsubscribeUrl),
  });
  if (sent.ok) {
    await getDb().update(subscribers).set({ welcomeSentAt: new Date().toISOString() }).where(and(eq(subscribers.id, row.id), isNull(subscribers.welcomeSentAt)));
  }
}

async function sendOneCampaign(
  campaign: typeof campaigns.$inferSelect,
  email: string,
  mailingAddress: string,
  origin: string,
  apiKey: string,
) {
  const db = getDb();
  const [existing] = await db.select().from(campaignRecipients).where(and(eq(campaignRecipients.campaignId, campaign.id), eq(campaignRecipients.email, email)));
  if (existing?.status === "sent" || existing?.status === "delivered") return false;
  const [person] = await db.select().from(subscribers).where(eq(subscribers.email, email));
  if (!person || person.status !== "confirmed") return false;
  const message = campaignMessage(campaign, person.unsubscribeToken, { mailingAddress, publicSiteUrl: origin }, "direct");
  const sent = await sendResendEmail({
    apiKey,
    from: sender("news"),
    to: [email],
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: `campaign:${campaign.id}:${email}`,
    headers: listHeaders(message.unsubscribeUrl),
  });
  const now = new Date().toISOString();
  const values = {
    status: sent.ok ? "sent" : "failed",
    resendId: sent.ok ? sent.id : null,
    error: sent.ok ? null : sent.error,
  };
  if (!existing) {
    try {
      await db.insert(campaignRecipients).values({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        email,
        createdAt: now,
        ...values,
      });
    } catch (error) {
      if (!isUniqueError(error)) throw error;
    }
    return sent.ok;
  }
  await db.update(campaignRecipients).set(values).where(eq(campaignRecipients.id, existing.id));
  return sent.ok;
}

function campaignMessage(
  campaign: { subject: string; preheader: string; bodyText: string; blocksJson?: string | null; kind?: string | null },
  unsubscribeToken: string,
  settings: { mailingAddress: string; publicSiteUrl: string },
  mode: "direct" | "broadcast",
) {
  const links = marketingLinks(settings.publicSiteUrl, unsubscribeToken);
  const unsubscribeUrl = mode === "broadcast" ? "{{{RESEND_UNSUBSCRIBE_URL}}}" : links.unsubscribeUrl;
  const preferencesUrl = mode === "broadcast" ? `${publicSiteUrl(settings.publicSiteUrl)}/newsletter/preferences` : links.preferencesUrl;
  const stored = readAnnouncement(campaign.blocksJson);
  const character = stored ? characterFromLink(stored.blocks[0]?.ctaUrl ?? "") : null;
  if (stored && character && stored.blocks.length === 1 && campaign.kind === "product_restocked") {
    const rendered = renderBackInStockEmail({
      origin: settings.publicSiteUrl,
      character,
      productName: stored.blocks[0]?.title ?? stored.headline,
      productUrl: stored.blocks[0]?.ctaUrl ?? links.shopUrl,
      unsubscribeUrl,
      preferencesUrl,
      mailingAddress: settings.mailingAddress,
    });
    return { ...rendered, unsubscribeUrl };
  }
  if (stored && character && stored.blocks.length === 1 && campaign.kind === "product_published") {
    const rendered = renderLaunchEmail({
      origin: settings.publicSiteUrl,
      character,
      headline: stored.headline,
      paragraphs: [stored.blocks[0]?.body ?? stored.intro],
      productUrl: stored.blocks[0]?.ctaUrl ?? links.shopUrl,
      unsubscribeUrl,
      preferencesUrl,
      mailingAddress: settings.mailingAddress,
    });
    return { ...rendered, unsubscribeUrl };
  }
  if (stored) {
    const rendered = renderAnnouncementEmail(stored, {
      unsubscribeUrl,
      preferencesUrl,
      mailingAddress: settings.mailingAddress,
      shopUrl: links.shopUrl,
    });
    return { ...rendered, unsubscribeUrl };
  }
  const rendered = renderMarketingEmail({
    subject: campaign.subject,
    headline: campaign.subject,
    eyebrow: "KAPO news",
    preheader: campaign.preheader,
    paragraphs: splitParagraphs(campaign.bodyText),
    unsubscribeUrl,
    preferencesUrl,
    mailingAddress: settings.mailingAddress,
    logoUrl: links.logoUrl,
    ctaLabel: "Shop collection",
    ctaUrl: links.shopUrl,
    character: "kobi",
    characterMode: "hero",
  });
  return { ...rendered, unsubscribeUrl };
}

async function loadDraft(id: string) {
  await ensureCommerceSchema();
  const [campaign] = await getDb().select().from(campaigns).where(eq(campaigns.id, id));
  return campaign ?? null;
}

export async function syncSubscriberTopics(email: string, unsubscribed: boolean, preferences?: Preferences) {
  const settings = commerceEnv();
  const topics = topicSubscriptions(preferences ?? defaultPreferences());
  if (!settings.resendKey || (!settings.resendAudienceId && topics.length === 0)) return;
  await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      unsubscribed,
      ...(settings.resendAudienceId ? { audienceId: settings.resendAudienceId } : {}),
      ...(topics.length ? { topics } : {}),
    }),
  }).catch(() => undefined);
}

async function syncAudience(email: string, unsubscribed: boolean) {
  const [row] = await getDb().select().from(subscribers).where(eq(subscribers.email, email));
  await syncSubscriberTopics(email, unsubscribed, parsePreferences(row?.preferencesJson));
}

export async function requestPreferenceLink(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!isEmailAddress(normalized)) return { ok: true as const };
  await ensureCommerceSchema();
  const [row] = await getDb().select().from(subscribers).where(eq(subscribers.email, normalized));
  if (!row || row.status !== "confirmed" || !commerceEnv().resendKey) return { ok: true as const };
  const settings = commerceEnv();
  const links = marketingLinks(settings.publicSiteUrl, row.unsubscribeToken);
  const message = renderMarketingEmail({
    subject: "Your KAPO email preferences",
    headline: "Choose what you get",
    eyebrow: "KAPO news",
    preheader: "A link to your KAPO email preferences.",
    paragraphs: ["Use this link to choose product launches, deals, YouTube, Instagram, and KAPO news. It only works for this address."],
    ctaLabel: "Manage preferences",
    ctaUrl: links.preferencesUrl,
    preferencesUrl: links.preferencesUrl,
    unsubscribeUrl: links.unsubscribeUrl,
    mailingAddress: settings.mailingAddress || "KAPO has not published a mailing address yet.",
    logoUrl: links.logoUrl,
    character: "kobi",
    characterMode: "compact",
  });
  await sendResendEmail({
    apiKey: settings.resendKey,
    from: sender("news"),
    to: [normalized],
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: `preferences-link:${normalized}:${new Date().toISOString().slice(0, 13)}`,
    headers: listHeaders(links.unsubscribeUrl),
  });
  return { ok: true as const };
}

async function sendBroadcast(
  apiKey: string,
  audienceId: string,
  topicId: string,
  campaign: { subject: string; preheader: string; bodyText: string; blocksJson?: string | null },
  mailingAddress: string,
  origin: string,
) {
  const message = campaignMessage(campaign, "audience", { mailingAddress, publicSiteUrl: origin }, "broadcast");
  const created = await fetch("https://api.resend.com/broadcasts", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(audienceId ? { audienceId } : {}),
      ...(topicId ? { topicId } : {}),
      from: sender("news"),
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!created.ok) return { ok: false as const, message: "Resend did not create the broadcast." };
  const json = await created.json() as { id?: string };
  if (!json.id) return { ok: false as const, message: "Resend did not return a broadcast id." };
  const sent = await fetch(`https://api.resend.com/broadcasts/${json.id}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  });
  if (!sent.ok) return { ok: false as const, message: "Resend did not send the broadcast." };
  return { ok: true as const, id: json.id };
}

function listHeaders(unsubscribeUrl: string) {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function characterFromLink(url: string): CharacterSlug | null {
  const slug = url.match(/\/characters\/([a-z]+)/)?.[1] ?? "";
  return characters.some((character) => character.slug === slug) ? slug as CharacterSlug : null;
}

function readTopics(campaign: { kind?: string | null; topic?: string | null; topicsJson?: string | null }) {
  if (campaign.kind === "digest" && campaign.topicsJson) {
    try {
      const parsed = JSON.parse(campaign.topicsJson) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return [campaign.topic || "news"];
    }
  }
  return [campaign.topic || "news"];
}

async function recordMarketingSend(email: string, campaignId: string, topic: string, routine: number, sentAt: string) {
  try {
    await getDb().insert(marketingSends).values({
      id: crypto.randomUUID(),
      email,
      campaignId,
      topic,
      routine,
      sentAt,
    });
  } catch (error) {
    if (!isUniqueError(error)) throw error;
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
