import assert from "node:assert/strict";
import test from "node:test";
import { isAdminEmail } from "../lib/commerce/authz.ts";
import { deliverEmail } from "../lib/commerce/email.ts";
import { renderEmail } from "../lib/commerce/email-template.ts";
import { applyTrackingStatus } from "../lib/commerce/status.ts";
import { sendResendEmail } from "../lib/email/client.ts";
import { renderAnnouncementEmail, sampleAnnouncement } from "../lib/email/announcement.ts";
import { renderMarketingEmail } from "../lib/email/marketing.ts";
import { campaignSendBlock, subscriptionPlan, webhookClaimDecision } from "../lib/email/policy.ts";
import {
  defaultPreferences,
  deliveryMode,
  parsePreferences,
  productNotices,
  subscriberFitsCampaign,
  substantialPriceDrop,
} from "../lib/email/topics.ts";
import { parseYouTubeFeed, youtubeHubChallenge, youtubeVideoId } from "../lib/email/youtube.ts";
import { notificationStatusForEvent, verifyResendWebhook } from "../lib/email/webhook.ts";
import { parseSupportRequest } from "../lib/support/validate.ts";

const order = {
  orderNumber: "KAPO-100",
  customerName: "Ada",
  customerEmail: "ada@example.com",
  currency: "usd",
  merchandiseSubtotalCents: 2400,
  discountCents: 0,
  discountCode: null,
  shippingCents: 540,
  taxCents: 0,
  totalCents: 2940,
  refundedCents: 0,
  paymentStatus: "paid",
  productionStatus: "awaiting_production",
  shippingStatus: "quoted",
  carrier: "USPS",
  serviceName: "Ground Advantage",
  trackingNumber: "9400",
  trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400",
  shipLine1: "1 Market Street",
  shipCity: "Philadelphia",
  shipState: "PA",
  shipPostalCode: "19103",
  shipCountry: "US",
  orderUrl: "https://shopkapo.com/account/orders/KAPO-100",
  supportUrl: "https://shopkapo.com/?chat=1",
  items: [{ name: "Spore — Flat Keycap", quantity: 1, lineTotalCents: 2400 }],
};

test("order confirmation renders the real order, address, and order link", () => {
  const email = renderEmail("order_confirmation", order);
  assert.match(email.subject, /KAPO-100/);
  assert.match(email.text, /Spore — Flat Keycap/);
  assert.match(email.text, /\$29\.40/);
  assert.match(email.text, /1 Market Street/);
  assert.match(email.html, /View order KAPO-100/);
  assert.match(email.html, /https:\/\/shopkapo.com\/account\/orders\/KAPO-100/);
  assert.match(email.html, /spore-artisan\.png/);
  assert.match(email.html, /#FFF0F2/);
  assert.match(email.html, /data:image\/png;base64,/);
  assert.match(email.html, /alt="KAPO"/);
  assert.match(email.html, /https:\/\/www\.instagram\.com\/shopkapokb\//);
  assert.match(email.html, /https:\/\/www\.youtube\.com\/@kapokeycaps/);
  assert.match(email.html, /alt="Instagram"/);
  assert.match(email.html, /alt="YouTube"/);
  assert.match(email.text, /support@shopkapo.com/);
  assert.match(email.text, /Instagram: https:\/\/www\.instagram\.com\/shopkapokb\//);
  assert.match(email.text, /YouTube: https:\/\/www\.youtube\.com\/@kapokeycaps/);
  assert.match(email.text, /Shipping \$5\.40/);
  assert.match(email.text, /Tax \$0\.00/);
  assert.equal(email.html.includes("production completion date"), false);
});

test("shipment and delivery templates use carrier facts", () => {
  const shipped = renderEmail("shipment_confirmation", order);
  assert.match(shipped.text, /USPS/);
  assert.match(shipped.html, /Track 9400/);
  assert.match(shipped.html, /orbit-artisan\.png/);
  const delivered = renderEmail("delivery_confirmation", order);
  assert.match(delivered.html, /Contact KAPO Support/);
  assert.match(delivered.html, /rango-artisan\.png/);
  const failed = renderEmail("payment_failed", order);
  assert.equal(failed.html.includes("-artisan.png"), false);
  const almost = renderEmail("out_for_delivery", { ...order, expectedDelivery: "Thursday, October 22" });
  assert.match(almost.html, /Thursday, October 22/);
  assert.match(almost.html, /brine-artisan\.png/);
});

test("tracking events choose shipment, delivery, and out-for-delivery emails", () => {
  assert.deepEqual(applyTrackingStatus("label_purchased", "ready_to_ship", "PRE_TRANSIT").emails, []);
  assert.deepEqual(applyTrackingStatus("label_purchased", "ready_to_ship", "TRANSIT").emails, ["shipment_confirmation"]);
  assert.deepEqual(applyTrackingStatus("in_transit", "shipped", "TRANSIT", "out_for_delivery").emails, ["out_for_delivery"]);
  assert.deepEqual(applyTrackingStatus("in_transit", "shipped", "DELIVERED").emails, ["delivery_confirmation"]);
  assert.deepEqual(applyTrackingStatus("in_transit", "shipped", "FAILURE").emails, ["delivery_exception"]);
  assert.deepEqual(applyTrackingStatus("in_transit", "shipped", "RETURNED").emails, ["returned_shipment"]);
});

test("rejects an invalid recipient before calling Resend", async () => {
  let called = false;
  const result = await sendResendEmail({
    apiKey: "re_test",
    from: "KAPO Orders <orders@shopkapo.com>",
    to: ["not-an-email"],
    subject: "Hello",
    html: "<p>Hello</p>",
    text: "Hello",
    pace: false,
    fetchImpl: async () => {
      called = true;
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "invalid_recipient");
  assert.equal(called, false);
});

test("sends through Resend and retries a rate limit", async () => {
  const statuses = [429, 200];
  const sent = await sendResendEmail({
    apiKey: "re_test",
    from: "KAPO Orders <orders@shopkapo.com>",
    to: ["ada@example.com"],
    subject: "Hello",
    html: "<p>Hello</p>",
    text: "Hello",
    idempotencyKey: "order-1",
    pace: false,
    sleep: async () => undefined,
    fetchImpl: async (_url, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Idempotency-Key"), "order-1");
      assert.equal(headers.get("Authorization")?.includes("re_test"), true);
      const status = statuses.shift() ?? 200;
      return new Response(JSON.stringify({ id: "email_123" }), { status, headers: { "content-type": "application/json" } });
    },
  });
  assert.deepEqual(sent, { ok: true, id: "email_123" });
});

test("sent mail attaches the wordmark instead of leaving it as a remote image", async () => {
  const email = renderEmail("order_confirmation", order);
  let payload: { html?: string; attachments?: { filename?: string; content_id?: string; content?: string }[] } = {};
  const sent = await sendResendEmail({
    apiKey: "re_test",
    from: "KAPO Orders <orders@shopkapo.com>",
    to: ["ada@example.com"],
    subject: email.subject,
    html: email.html,
    text: email.text,
    pace: false,
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: "email_logo" }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(sent.ok, true);
  assert.match(payload.html ?? "", /src="cid:kapo-wordmark"/);
  assert.match(payload.html ?? "", /https:\/\/shopkapo\.com\/social\/instagram\.png/);
  assert.match(payload.html ?? "", /https:\/\/shopkapo\.com\/social\/youtube\.png/);
  assert.match(payload.html ?? "", /https:\/\/www\.instagram\.com\/shopkapokb\//);
  assert.match(payload.html ?? "", /https:\/\/www\.youtube\.com\/@kapokeycaps/);
  assert.equal((payload.html ?? "").includes("data:image/png"), false);
  assert.equal((payload.html ?? "").includes("kapo-wordmark.png"), false);
  assert.equal(payload.attachments?.[0]?.filename, "kapo-wordmark.png");
  assert.equal(payload.attachments?.[0]?.content_id, "kapo-wordmark");
  assert.equal((payload.attachments?.[0]?.content ?? "").length > 1000, true);
  assert.equal(payload.attachments?.length, 1);
});

test("records an API failure without a message id", async () => {
  const result = await deliverEmail({
    apiKey: "re_test",
    order,
    template: "order_confirmation",
    pace: false,
    sleep: async () => undefined,
    fetchImpl: async () => new Response("no", { status: 422 }),
  });
  assert.equal(result.status, "failed");
  assert.equal(result.id, null);
  assert.equal(result.error, "resend_422");
});

test("queues when Resend is not configured", async () => {
  const result = await deliverEmail({ apiKey: "", order, template: "payment_confirmation", pace: false });
  assert.equal(result.status, "queued");
  assert.equal(result.error, "email_provider_not_configured");
});

test("newsletter consent, unsubscribe state, and campaign blocks", () => {
  assert.equal(subscriptionPlan(null, false).ok, false);
  assert.equal(subscriptionPlan(null, true).ok && subscriptionPlan(null, true).action, "create");
  assert.equal(subscriptionPlan({ status: "confirmed" }, true).action, "already");
  assert.equal(subscriptionPlan({ status: "unsubscribed" }, true).action, "resubscribe");
  assert.equal(campaignSendBlock({ mailingAddress: "", confirmedCount: 2, status: "draft" })?.includes("KAPO_MAILING_ADDRESS"), true);
  assert.equal(campaignSendBlock({ mailingAddress: "1 Main St", confirmedCount: 0, status: "draft" })?.includes("confirmed"), true);
  assert.equal(campaignSendBlock({ mailingAddress: "1 Main St", confirmedCount: 2, status: "sent" }), "This campaign was already sent.");
  assert.equal(campaignSendBlock({ mailingAddress: "1 Main St", confirmedCount: 2, status: "draft" }), null);
  const marketing = renderMarketingEmail({
    subject: "A new character",
    preheader: "Shop news",
    paragraphs: ["Gloop is here."],
    unsubscribeUrl: "https://shopkapo.com/newsletter/unsubscribe?token=abc",
    mailingAddress: "1 Main St, Philadelphia, PA",
  });
  assert.match(marketing.text, /Unsubscribe from KAPO news/);
  assert.match(marketing.html, /1 Main St, Philadelphia, PA/);
  assert.match(marketing.html, /kobi-artisan\.png/);
  assert.match(marketing.html, /data:image\/png;base64,/);
  assert.match(marketing.html, /alt="KAPO"/);
  assert.match(marketing.html, /alt="Instagram"/);
  assert.match(marketing.html, /alt="YouTube"/);
  assert.match(marketing.text, /instagram\.com\/shopkapokb/);
  assert.match(marketing.text, /youtube\.com\/@kapokeycaps/);
});

test("product announcements fire once, and small or upward price changes stay quiet", () => {
  const hidden = { available: false, priceCents: null };
  const live = { available: true, priceCents: 1199 };
  assert.deepEqual(productNotices({ id: "spore-artisan", before: hidden, after: live, launchAnnounced: false, day: "2026-10-18" }), [
    { kind: "product_published", dedupeKey: "product:spore-artisan:launch" },
  ]);
  assert.deepEqual(productNotices({ id: "spore-artisan", before: live, after: { ...live }, launchAnnounced: true, day: "2026-10-18" }), []);
  assert.deepEqual(productNotices({ id: "spore-artisan", before: hidden, after: live, launchAnnounced: true, day: "2026-10-18" }), [
    { kind: "product_restocked", dedupeKey: "product:spore-artisan:restock:2026-10-18" },
  ]);
  assert.equal(substantialPriceDrop(1199, 1299), false);
  assert.equal(substantialPriceDrop(1199, 1099), false);
  assert.equal(substantialPriceDrop(1199, 999), true);
  assert.deepEqual(productNotices({
    id: "spore-artisan",
    before: live,
    after: { available: true, priceCents: 999 },
    launchAnnounced: true,
    day: "2026-10-18",
  }), [{ kind: "promotion", dedupeKey: "product:spore-artisan:price:999" }]);
});

test("weekly cap holds routine mail and lets launches and every-post subscribers through", () => {
  const weekly = defaultPreferences();
  const immediate = { ...weekly, frequency: "immediate" as const };
  const base = { status: "confirmed", topics: ["news"], audience: "all", routineSends: 2 };
  assert.equal(subscriberFitsCampaign({ ...base, preferences: weekly, kind: "promotion", topic: "deals" }).reason, "cap");
  assert.equal(subscriberFitsCampaign({ ...base, preferences: weekly, kind: "product_published", topic: "products" }).ok, true);
  assert.equal(subscriberFitsCampaign({ ...base, preferences: immediate, kind: "youtube", topic: "youtube" }).ok, true);
  assert.equal(subscriberFitsCampaign({ ...base, preferences: { ...weekly, youtube: false }, kind: "youtube", topic: "youtube" }).reason, "topic_off");
  assert.equal(subscriberFitsCampaign({ ...base, preferences: weekly, kind: "digest", topic: "news", topics: ["youtube"], audience: "weekly", routineSends: 0 }).ok, true);
  assert.equal(deliveryMode({ audience: "all", topicConfigured: true, capped: 0, recipientCount: 12 }), "broadcast");
  assert.equal(deliveryMode({ audience: "weekly", topicConfigured: true, capped: 0, recipientCount: 12 }), "direct");
  assert.equal(deliveryMode({ audience: "all", topicConfigured: false, capped: 0, recipientCount: 501 }), "too_many");
  assert.equal(parsePreferences("{\"youtube\":false,\"frequency\":\"immediate\"}").youtube, false);
  assert.equal(parsePreferences("nope").frequency, "weekly");
});

test("announcement mail includes the product, preferences, and mailing address", () => {
  const content = sampleAnnouncement("product_published", "https://shopkapo.com");
  const email = renderAnnouncementEmail(content, {
    unsubscribeUrl: "https://shopkapo.com/newsletter/unsubscribe?token=abc",
    preferencesUrl: "https://shopkapo.com/newsletter/preferences?token=abc",
    mailingAddress: "1 Main St, Philadelphia, PA",
    shopUrl: "https://shopkapo.com/shop",
  });
  assert.match(email.html, /Meet Spore/);
  assert.match(email.html, /Shop Now/);
  assert.match(email.html, /spore-artisan\.png/);
  assert.match(email.text, /Manage preferences/);
  assert.match(email.html, /1 Main St, Philadelphia, PA/);
  assert.match(email.text, /Unsubscribe/);
});

test("youtube notifications verify the hub and ignore repeat videos by id", () => {
  assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=abcdefghijk"), "abcdefghijk");
  assert.equal(youtubeVideoId("https://www.youtube.com/shorts/abcdefghijk"), "abcdefghijk");
  assert.equal(youtubeVideoId("https://example.com/watch?v=abcdefghijk"), null);
  const feed = `<?xml version="1.0"?><feed><entry><yt:videoId>abcdefghijk</yt:videoId><title>Meet Spore</title><link rel="alternate" href="https://www.youtube.com/watch?v=abcdefghijk"/></entry></feed>`;
  assert.equal(parseYouTubeFeed(feed)[0]?.title, "Meet Spore");
  const params = new URLSearchParams({ "hub.mode": "subscribe", "hub.challenge": "ok-token", "hub.verify_token": "kapo" });
  assert.equal(youtubeHubChallenge(params, "kapo"), "ok-token");
  assert.equal(youtubeHubChallenge(params, "other"), null);
});

test("webhook duplicates and Resend signatures", async () => {
  assert.equal(webhookClaimDecision(undefined), "claimed");
  assert.equal(webhookClaimDecision("failed"), "claimed");
  assert.equal(webhookClaimDecision("processed"), "duplicate");
  assert.equal(webhookClaimDecision("processing", 0), "in_progress");
  assert.equal(webhookClaimDecision("processing", 90_000), "claimed");
  assert.equal(notificationStatusForEvent("email.delivered"), "delivered");
  assert.equal(notificationStatusForEvent("email.complained"), "complained");
  assert.equal(notificationStatusForEvent("email.opened"), null);
  const secretBytes = new TextEncoder().encode("kapo-webhook-secret");
  const secret = `whsec_${btoa(String.fromCharCode(...secretBytes))}`;
  const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "email_123" } });
  const id = "msg_1";
  const timestamp = "1700000000";
  const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(secret.slice(6)), (char) => char.charCodeAt(0)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
  const signature = `v1,${btoa(String.fromCharCode(...new Uint8Array(signed)))}`;
  assert.equal(await verifyResendWebhook({ secret, id, timestamp, signature, payload, nowSeconds: 1700000010 }), true);
  assert.equal(await verifyResendWebhook({ secret, id, timestamp, signature: "v1,bad", payload, nowSeconds: 1700000010 }), false);
});

test("support requests need a message and admin email stays allowlisted", () => {
  assert.equal(parseSupportRequest({ message: "hi", idempotencyKey: "short" }), null);
  assert.deepEqual(parseSupportRequest({ message: "The keycap arrived cracked.", idempotencyKey: "123e4567-e89b-12d3-a456-426614174000" })?.message, "The keycap arrived cracked.");
  assert.equal(isAdminEmail("visitor@example.com", "founder@shopkapo.com"), false);
  assert.equal(isAdminEmail("founder@shopkapo.com", "founder@shopkapo.com"), true);
});
