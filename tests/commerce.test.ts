import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { addressesMatch, normalizeAddress } from "../lib/commerce/address.ts";
import { customerCanViewOrder, isAdminEmail, liveModeBlocked } from "../lib/commerce/authz.ts";
import {
  authorizeLabelPurchase,
  classifyPurchaseError,
  classifyTransaction,
  clearAttemptAllowed,
  confirmationMatches,
  dailyLimitMessage,
  dailySpendAllowed,
  labelPurchaseMode,
  priceAllowed,
  resolveLabelLimits,
  spendingDay,
  spendingWindow,
} from "../lib/commerce/label-guards.ts";
import { assessPaidSession, checkoutReturnOrigin, checkoutSessionIdempotencyKey, planCheckoutContinuation, quotedChargeCents } from "../lib/commerce/checkout-session.ts";
import { allocateDiscount, applyDiscount, parseDiscountCodes } from "../lib/commerce/discounts.ts";
import { renderEmail } from "../lib/commerce/email-template.ts";
import { formatCents, moneyStringToCents, priceToCents } from "../lib/commerce/money.ts";
import { buildParcel } from "../lib/commerce/parcel.ts";
import { cartHash, merchandiseSubtotal, priceCart } from "../lib/commerce/products.ts";
import { cheapestRate, customerShippingOptions, isQuoteExpired, normalizeRates, quoteExpiry } from "../lib/commerce/rates.ts";
import { orderUpdateText, toE164Us } from "../lib/commerce/sendblue.ts";
import { resolveShippoAccess } from "../lib/commerce/shippo-mode.ts";
import { hashValue, verifyTimestampedHmac } from "../lib/commerce/signatures.ts";
import {
  applyRefundSnapshot,
  applyTrackingStatus,
  canMarkShipped,
  labelPurchaseResult,
  paymentSuccessEmails,
  planLabelPurchase,
  refundPaymentStatus,
  summarizeFinance,
} from "../lib/commerce/status.ts";

const codes = parseDiscountCodes("CREW10:percent:10,WELCOME:amount:500");

test("prices multiple products and quantities from the server catalog", () => {
  const priced = priceCart([
    { productId: "spore-flat", quantity: 2 },
    { productId: "gloop-artisan", quantity: 1 },
  ]);
  assert.equal(priced.ok, true);
  if (!priced.ok) return;
  assert.equal(priced.lines[0].unitPriceCents, 699);
  assert.equal(priced.lines[1].unitPriceCents, 1199);
  assert.equal(merchandiseSubtotal(priced.lines), 699 * 2 + 1199);
  assert.equal(priceToCents(4.99), 499);
  assert.equal(priceToCents(11.99), 1199);
});

test("rejects macropads until sales are explicitly enabled with a price", () => {
  const pricedGate = { published: true, forSale: true, priceCents: 4900, inventory: 3 };
  for (const productId of ["macropad-bare", "macropad-custom", "macropad-bare-white", "MACROPAD-custom-99"]) {
    const priced = priceCart([{ productId, quantity: 1 }]);
    assert.equal(priced.ok, false);
    if (!priced.ok) assert.match(priced.message, /coming soon/i);
  }
  const spoofed = priceCart([{ productId: "macropad-bare", quantity: 1 }]);
  assert.equal(spoofed.ok, false);
  const missingPrice = priceCart([{ productId: "macropad-bare", quantity: 1 }], { ...pricedGate, priceCents: null });
  assert.equal(missingPrice.ok, false);
  const salesOff = priceCart([{ productId: "macropad-bare", quantity: 1 }], { ...pricedGate, forSale: false });
  assert.equal(salesOff.ok, false);
  const hidden = priceCart([{ productId: "macropad-bare", quantity: 1 }], { ...pricedGate, published: false });
  assert.equal(hidden.ok, false);
  const open = priceCart([{ productId: "macropad-bare-white", quantity: 1 }], pricedGate);
  assert.equal(open.ok, true);
  if (open.ok) assert.equal(open.lines[0].unitPriceCents, 4900);
  const overStock = priceCart([{ productId: "macropad-custom", quantity: 4 }], pricedGate);
  assert.equal(overStock.ok, false);
  const keycap = priceCart([{ productId: "gloop-flat", quantity: 1 }]);
  assert.equal(keycap.ok, true);
  if (keycap.ok) assert.equal(keycap.lines[0].unitPriceCents, 699);
  const unknown = priceCart([{ productId: "not-real", quantity: 1 }]);
  assert.equal(unknown.ok, false);
  assert.equal(priceCart([{ productId: "gloop-artisan", quantity: 0 }]).ok, false);
  assert.equal(priceCart([{ productId: "gloop-artisan", quantity: -2 }]).ok, false);
  assert.equal(priceCart([{ productId: "gloop-artisan", quantity: 1.5 }]).ok, false);
  const spoofedPrice = priceCart([{ productId: "gloop-artisan", quantity: 2, unitPrice: 1 } as { productId: string; quantity: number }]);
  assert.equal(spoofedPrice.ok, true);
  if (spoofedPrice.ok) assert.equal(spoofedPrice.lines[0].unitPriceCents, 1199);
});

test("applies discounts without letting them exceed the merchandise subtotal", () => {
  assert.deepEqual(applyDiscount(2000, "crew10", codes), { ok: true, code: "CREW10", discountCents: 200 });
  assert.deepEqual(applyDiscount(300, "WELCOME", codes), { ok: true, code: "WELCOME", discountCents: 300 });
  assert.equal(applyDiscount(2000, "NOPE", codes).ok, false);
  assert.deepEqual(allocateDiscount([500, 1500], 200), [50, 150]);
});

test("builds a heavier parcel for more keycaps and keeps a one-ounce minimum", () => {
  const one = buildParcel([{ weightGrams: 12, quantity: 1 }]);
  const many = buildParcel([{ weightGrams: 28, quantity: 10 }]);
  assert.ok(many.weightOz > one.weightOz);
  assert.equal(many.lengthIn, 10);
  assert.equal(one.lengthIn, 8);
  assert.ok(one.weightOz >= 1);
});

test("offers normal, fast, and super fast shipping with different transit times", () => {
  const nearby = customerShippingOptions(normalizeRates([
    { object_id: "ground", amount: "5.27", currency: "USD", provider: "USPS", estimated_days: 2, duration_terms: "Delivery in 2 to 5 days.", servicelevel: { name: "Ground Advantage", token: "usps_ground_advantage" } },
    { object_id: "saver", amount: "5.69", currency: "USD", provider: "UPS", estimated_days: 2, servicelevel: { name: "Ground Saver", token: "ups_ground_saver" } },
    { object_id: "priority", amount: "8.01", currency: "USD", provider: "USPS", estimated_days: 2, servicelevel: { name: "Priority Mail", token: "usps_priority" } },
    { object_id: "second", amount: "10.76", currency: "USD", provider: "UPS", estimated_days: 2, servicelevel: { name: "2nd Day Air", token: "ups_second_day_air" } },
    { object_id: "next", amount: "16.06", currency: "USD", provider: "UPS", estimated_days: 1, servicelevel: { name: "Next Day Air Saver", token: "ups_next_day_air_saver" } },
    { object_id: "express", amount: "32.51", currency: "USD", provider: "USPS", estimated_days: 1, servicelevel: { name: "Priority Mail Express", token: "usps_priority_express" } },
  ], 0));
  assert.deepEqual(nearby.map((rate) => [rate.tierLabel, rate.detail, rate.amountCents]), [
    ["Normal", "USPS Ground Advantage · 2–5 business days", 527],
    ["Fast", "USPS Priority Mail · 2 business days", 801],
    ["Super fast", "UPS Next Day Air Saver · 1 business day", 1606],
  ]);
  const far = customerShippingOptions(normalizeRates([
    { object_id: "ground", amount: "6.07", currency: "USD", provider: "USPS", estimated_days: 5, duration_terms: "Delivery in 2 to 5 days.", servicelevel: { name: "Ground Advantage", token: "usps_ground_advantage" } },
    { object_id: "three", amount: "11.18", currency: "USD", provider: "UPS", estimated_days: 3, servicelevel: { name: "3 Day Select", token: "ups_3_day_select" } },
    { object_id: "second", amount: "11.23", currency: "USD", provider: "UPS", estimated_days: 2, servicelevel: { name: "2nd Day Air", token: "ups_second_day_air" } },
    { object_id: "overnight", amount: "46.07", currency: "USD", provider: "UPS", estimated_days: 1, servicelevel: { name: "Next Day Air Saver", token: "ups_next_day_air_saver" } },
  ], 0));
  assert.deepEqual(far.map((rate) => [rate.tierLabel, rate.estimatedDays, rate.amountCents]), [
    ["Normal", 5, 607],
    ["Fast", 3, 1118],
    ["Super fast", 2, 1123],
  ]);
});

test("selects the cheapest tracked rate and ignores untracked or non-USD rates", () => {
  const rates = normalizeRates([
    { object_id: "fast", amount: "12.50", currency: "USD", provider: "UPS", estimated_days: 1, servicelevel: { name: "Ground", token: "ups_ground" }, duration_terms: "1 business day" },
    { object_id: "cheap", amount: "5.40", currency: "USD", provider: "USPS", estimated_days: 4, servicelevel: { name: "Ground Advantage", token: "usps_ground_advantage" }, duration_terms: "2 to 5 business days" },
    { object_id: "letter", amount: "1.00", currency: "USD", provider: "USPS", servicelevel: { name: "Letter", token: "usps_first_class_mail" } },
    { object_id: "foreign", amount: "4.00", currency: "CAD", provider: "USPS", servicelevel: { name: "Ground Advantage", token: "usps_ground_advantage" } },
  ], 50);
  assert.equal(rates.length, 2);
  assert.equal(cheapestRate(rates)?.id, "cheap");
  assert.equal(cheapestRate(rates)?.carrierAmountCents, 540);
  assert.equal(cheapestRate(rates)?.amountCents, 590);
  assert.equal(normalizeRates([], 0).length, 0);
});

test("expires shipping quotes", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const expires = quoteExpiry(now, 1800);
  assert.equal(isQuoteExpired(expires, now), false);
  assert.equal(isQuoteExpired(expires, new Date(now.getTime() + 1800 * 1000)), true);
});

test("validates domestic addresses and rejects international ones", () => {
  const valid = normalizeAddress({
    name: "Ada Lovelace",
    email: "ada@example.com",
    line1: "1 Market St",
    city: "Philadelphia",
    state: "pa",
    postalCode: "19103",
    country: "US",
  });
  assert.equal(valid.ok, true);
  const international = normalizeAddress({
    name: "Ada",
    email: "ada@example.com",
    line1: "1 Market St",
    city: "Toronto",
    state: "PA",
    postalCode: "19103",
    country: "CA",
  });
  assert.equal(international.ok, false);
  if (valid.ok) {
    assert.equal(addressesMatch(valid.address, { ...valid.address, line1: "1 market st" }), true);
    assert.equal(addressesMatch(valid.address, { ...valid.address, city: "Pittsburgh" }), false);
  }
});

test("accepts a paid Checkout Session only when server totals and address match", () => {
  const order = {
    merchandiseSubtotalCents: 998,
    discountCents: 0,
    shippingCents: 540,
    taxCents: 92,
    totalCents: 1630,
    shipLine1: "1 Market St",
    shipCity: "Philadelphia",
    shipState: "PA",
    shipPostalCode: "19103",
    shipCountry: "US",
  };
  assert.equal(assessPaidSession(order, {
    paymentStatus: "paid",
    amountSubtotal: 998,
    amountTotal: 1630,
    amountShipping: 540,
    amountDiscount: 0,
    amountTax: 92,
    shipping: { line1: "1 Market St", city: "Philadelphia", state: "PA", postalCode: "19103", country: "US" },
  }).action, "pay");
  assert.equal(assessPaidSession(order, {
    paymentStatus: "paid",
    amountSubtotal: 998,
    amountTotal: 100,
    amountShipping: 0,
    amountDiscount: 0,
    amountTax: 0,
    shipping: null,
  }).action, "review");
  assert.equal(quotedChargeCents(order), 1630);
  assert.equal(quotedChargeCents({ ...order, taxCents: 92 }), order.merchandiseSubtotalCents - order.discountCents + order.shippingCents + 92);
  assert.equal(assessPaidSession({ ...order, paymentStatus: "paid" } as typeof order, {
    paymentStatus: "unpaid",
    amountSubtotal: 998,
    amountTotal: 1630,
    amountShipping: 540,
    amountDiscount: 0,
    amountTax: 92,
    shipping: null,
  }).action, "ignore");
});

test("reuses an open Checkout Session only for the same rate and discount", () => {
  assert.equal(planCheckoutContinuation({ status: "open", paymentStatus: "unpaid", hasClientSecret: true, sameTerms: true }).action, "reuse");
  const changed = planCheckoutContinuation({ status: "open", paymentStatus: "unpaid", hasClientSecret: true, sameTerms: false });
  assert.equal(changed.action, "replace");
  if (changed.action === "replace") assert.equal(changed.expire, true);
  assert.equal(planCheckoutContinuation({ status: "complete", paymentStatus: "paid", hasClientSecret: false, sameTerms: false }).action, "wait");
  assert.equal(planCheckoutContinuation({ status: "expired", paymentStatus: "unpaid", hasClientSecret: false, sameTerms: true }).action, "replace");
  const first = checkoutSessionIdempotencyKey("order-1", "rate-a", 0, null);
  const second = checkoutSessionIdempotencyKey("order-1", "rate-b", 0, "cs_test_old");
  assert.notEqual(first, second);
  assert.equal(checkoutReturnOrigin("https://evil.example", "https://shopkapo.com", "production"), "https://shopkapo.com");
  assert.equal(checkoutReturnOrigin("http://localhost:3000", "https://shopkapo.com", "development"), "http://localhost:3000");
});

test("sends one confirmation email and keeps refunds from moving backward", () => {
  assert.deepEqual(paymentSuccessEmails(), ["order_confirmation"]);
  assert.equal(applyRefundSnapshot({ paymentStatus: "pending", refundedCents: 0, totalCents: 1600 }, 1600).action, "retry");
  assert.equal(applyRefundSnapshot({ paymentStatus: "paid", refundedCents: 500, totalCents: 1600 }, 200).action, "ignore");
  const applied = applyRefundSnapshot({ paymentStatus: "paid", refundedCents: 0, totalCents: 1600 }, 1600);
  assert.equal(applied.action, "apply");
  if (applied.action === "apply") assert.equal(applied.status, "refunded");
  assert.equal(refundPaymentStatus(1600, 400, "paid"), "partially_refunded");
});

test("verifies Stripe and Shippo style webhook signatures", async () => {
  const payload = JSON.stringify({ id: "evt_test_webhook", object: "event", type: "checkout.session.completed" });
  const secret = "whsec_test_secret";
  const stripe = new Stripe("sk_test_123", { httpClient: Stripe.createFetchHttpClient() });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  const event = await stripe.webhooks.constructEventAsync(payload, header, secret);
  assert.equal(event.id, "evt_test_webhook");
  await assert.rejects(() => stripe.webhooks.constructEventAsync(payload, header, "whsec_other"));
  const timestamp = "1700000000";
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=")));
  assert.equal(typeof parts.v1, "string");
  const shippoHeader = `t=${timestamp},v1=${parts.v1}`;
  const valid = await verifyTimestampedHmac({
    header: `t=${timestamp},v1=${await sign(secret, `${timestamp}.{"ok":true}`)}`,
    payload: '{"ok":true}',
    secret,
    nowSeconds: 1700000100,
  });
  assert.equal(valid, true);
  assert.equal(await verifyTimestampedHmac({ header: shippoHeader, payload: "tampered", secret, nowSeconds: Number(timestamp) }), false);
});

test("does not mark an order shipped when a label fails, and blocks duplicate purchases", () => {
  assert.deepEqual(labelPurchaseResult(false), { shippingStatus: "not_purchased", productionStatus: null, shipped: false });
  assert.equal(labelPurchaseResult(true).shipped, false);
  const now = new Date("2026-10-14T12:00:00Z");
  assert.equal(planLabelPurchase([{ status: "succeeded", createdAt: now.toISOString() }], now).ok, false);
  assert.equal(planLabelPurchase([{ status: "failed", createdAt: now.toISOString() }], now).ok, true);
  assert.equal(planLabelPurchase([{ status: "uncertain", createdAt: now.toISOString() }], now).ok, false);
  assert.equal(planLabelPurchase([{ status: "void_requested", createdAt: now.toISOString() }], now).ok, false);
  assert.equal(planLabelPurchase([{ status: "cleared", createdAt: now.toISOString() }, { status: "failed", createdAt: now.toISOString() }], now).ok, true);
  assert.equal(canMarkShipped({ paymentStatus: "paid", shippingStatus: "label_purchased", trackingNumber: "9400" }).ok, true);
  assert.equal(canMarkShipped({ paymentStatus: "paid", shippingStatus: "not_purchased", trackingNumber: null }).ok, false);
});

test("sends delivery email only for a delivered tracking event", () => {
  const delivered = applyTrackingStatus("in_transit", "shipped", "DELIVERED");
  assert.deepEqual(delivered.emails, ["delivery_confirmation"]);
  assert.equal(delivered.productionStatus, "delivered");
  const transit = applyTrackingStatus("label_purchased", "ready_to_ship", "TRANSIT");
  assert.ok(transit.emails.includes("shipment_confirmation"));
  const preview = applyTrackingStatus("label_purchased", "ready_to_ship", "PRE_TRANSIT");
  assert.equal(preview.emails.includes("delivery_confirmation"), false);
  assert.equal(preview.emails.includes("shipment_confirmation"), false);
});

test("separates gross sales, net revenue, and profit", () => {
  const finance = summarizeFinance([
    { paymentStatus: "paid", totalCents: 2000, refundedCents: 0, taxCents: 120, shippingCents: 500 },
    { paymentStatus: "refunded", totalCents: 1000, refundedCents: 1000, taxCents: 0, shippingCents: 0 },
  ], 450);
  assert.equal(finance.grossSalesCents, 3000);
  assert.equal(finance.netRevenueCents, 2000);
  assert.equal(finance.profitCents, 2000 - 120 - 450);
  assert.equal(refundPaymentStatus(2000, 2000, "paid"), "refunded");
  assert.equal(refundPaymentStatus(2000, 500, "paid"), "partially_refunded");
});

test("isolates customer orders and admin access", () => {
  const order = { customerUserId: "user-1", customerEmail: "ada@example.com" };
  assert.equal(customerCanViewOrder(order, { userId: "user-1", email: "other@example.com" }), true);
  assert.equal(customerCanViewOrder({ customerUserId: null, customerEmail: "ada@example.com" }, { userId: "user-2", email: "Ada@Example.com" }), false);
  assert.equal(customerCanViewOrder(order, { userId: "user-2", email: "other@example.com" }), false);
  assert.equal(isAdminEmail("Ada@Example.com", "other@example.com, ada@example.com"), true);
  assert.equal(isAdminEmail("ada@example.com", ""), false);
  assert.equal(liveModeBlocked("sk_live_123", "stripe", false)?.includes("KAPO_ALLOW_LIVE_PAYMENTS"), true);
  assert.equal(liveModeBlocked("sk_test_123", "stripe", false), null);
  assert.equal(liveModeBlocked("rk_live_123", "stripe", false)?.includes("KAPO_ALLOW_LIVE_PAYMENTS"), true);
  assert.equal(liveModeBlocked("shippo_live_123", "shippo", false)?.includes("KAPO_ALLOW_LIVE_LABELS"), true);
  assert.equal(liveModeBlocked("shippo_test_123", "shippo", false), null);
  assert.equal(liveModeBlocked("", "shippo", false), null);
  assert.equal(liveModeBlocked("raw-token", "shippo", false)?.includes("KAPO_ALLOW_LIVE_LABELS"), true);
  assert.equal(liveModeBlocked("shippo_live_123", "shippo", true), null);
});

test("label purchases require admin approval, a price cap, and a definite Shippo result", () => {
  const rate = { id: "rate_1", provider: "USPS", serviceName: "Ground Advantage", carrierAmountCents: 612, currency: "USD" };
  assert.equal(confirmationMatches(rate, { rateId: "rate_1", carrier: "USPS", serviceName: "Ground Advantage", amountCents: 612, confirmed: true }).ok, true);
  assert.equal(confirmationMatches(rate, { ...rate, rateId: "rate_1", carrier: "USPS", serviceName: "Ground Advantage", amountCents: 700, confirmed: true }).ok, false);
  assert.equal(confirmationMatches(rate, { rateId: "rate_1", carrier: "USPS", serviceName: "Ground Advantage", amountCents: 612, confirmed: false }).ok, false);
  assert.equal(priceAllowed(1500, 1500).ok, true);
  assert.equal(priceAllowed(1501, 1500).ok, false);
  assert.equal(resolveLabelLimits(5000, 20000, false).maxLabelCents, 1500);
  assert.equal(resolveLabelLimits(5000, 20000, false).dailyMaxCents, 5000);
  assert.equal(resolveLabelLimits(900, 2000, true).dailyMaxCents, 2000);
  assert.match(dailyLimitMessage(5000), /\$50\.00/);
  assert.equal(spendingDay(new Date("2026-10-19T03:30:00Z")), "2026-10-18");
  assert.equal(spendingDay(new Date("2026-10-19T04:30:00Z")), "2026-10-19");
  assert.equal(authorizeLabelPurchase({ source: "stripe_webhook", actor: "ada@example.com", adminEmails: "ada@example.com", devBypass: false }).ok, false);
  assert.equal(authorizeLabelPurchase({ source: "admin_dashboard", actor: "stripe", adminEmails: "ada@example.com", devBypass: false }).ok, false);
  assert.equal(authorizeLabelPurchase({ source: "admin_dashboard", actor: "ada@example.com", adminEmails: "ada@example.com", devBypass: false }).ok, true);
  assert.equal(authorizeLabelPurchase({ source: "admin_dashboard", actor: "dev-admin@localhost", adminEmails: "", devBypass: true }).ok, true);
  assert.equal(authorizeLabelPurchase({ source: "admin_dashboard", actor: "dev-admin@localhost", adminEmails: "", devBypass: false }).ok, false);
  assert.equal(clearAttemptAllowed("KAPO-1001", "KAPO-1001", true).ok, true);
  assert.equal(clearAttemptAllowed("KAPO-1001", "KAPO-1001", false).ok, false);
  assert.equal(clearAttemptAllowed("KAPO-1001", "nope", true).ok, false);
  assert.equal(classifyTransaction({ status: "SUCCESS", object_id: "txn_1" }), "succeeded");
  assert.equal(classifyTransaction({ status: "ERROR", object_id: "txn_1" }), "failed");
  assert.equal(classifyTransaction({ status: "QUEUED", object_id: "txn_1" }), "uncertain");
  assert.equal(dailySpendAllowed(5000, 5000).ok, true);
  assert.equal(dailySpendAllowed(5001, 5000).ok, false);
  const window = spendingWindow(new Date("2026-10-19T03:30:00Z"));
  assert.equal(window.day, "2026-10-18");
  assert.equal(window.startIso, "2026-10-18T04:00:00.000Z");
  assert.equal(window.endIso, "2026-10-19T04:00:00.000Z");
  const testKey = "shippo_test_abc";
  const liveKey = "shippo_live_def";
  const testing = resolveShippoAccess({ mode: "test", testKey, liveKey, legacyToken: liveKey, allowLiveLabels: false });
  assert.equal(testing.mode, "test");
  assert.equal(testing.token, testKey);
  assert.equal(testing.livePurchasing, false);
  const blocked = resolveShippoAccess({ mode: "live", testKey, liveKey, allowLiveLabels: false });
  assert.equal(blocked.liveBlocked, true);
  assert.equal(blocked.token, testKey);
  assert.equal(blocked.livePurchasing, false);
  const approved = resolveShippoAccess({ mode: "live", testKey, liveKey, allowLiveLabels: true });
  assert.equal(approved.mode, "live");
  assert.equal(approved.token, liveKey);
  assert.equal(approved.livePurchasing, true);
  assert.equal(resolveShippoAccess({ mode: "test", legacyToken: liveKey, allowLiveLabels: true }).token, "");
  assert.equal(classifyTransaction({ status: "SUCCESS" }), "uncertain");
  assert.equal(classifyPurchaseError({ status: 400, code: "invalid_address" }), "failed");
  assert.equal(classifyPurchaseError({ status: 504, code: "carrier_timeout" }), "uncertain");
  assert.equal(classifyPurchaseError({ status: 502, code: "shipping_unavailable" }), "uncertain");
  assert.equal(classifyPurchaseError(null), "uncertain");
  assert.equal(labelPurchaseMode("", false), "unconfigured");
  assert.equal(labelPurchaseMode("shippo_test_123", false), "test");
  assert.equal(labelPurchaseMode("shippo_live_123", false), "live_blocked");
  assert.equal(labelPurchaseMode("shippo_live_123", true), "live");
});

test("cart hashes ignore client order and emails include totals", async () => {
  const left = await cartHash([
    { productId: "spore-flat", name: "Spore", style: "Flat", image: "/a.png", unitPriceCents: 499, quantity: 1, weightGrams: 12, lineTotalCents: 499 },
    { productId: "gloop-artisan", name: "Gloop", style: "Artisan", image: "/b.png", unitPriceCents: 1199, quantity: 2, weightGrams: 28, lineTotalCents: 2398 },
  ]);
  const right = await cartHash([
    { productId: "gloop-artisan", name: "Gloop", style: "Artisan", image: "/b.png", unitPriceCents: 1199, quantity: 2, weightGrams: 28, lineTotalCents: 2398 },
    { productId: "spore-flat", name: "Spore", style: "Flat", image: "/a.png", unitPriceCents: 499, quantity: 1, weightGrams: 12, lineTotalCents: 499 },
  ]);
  assert.equal(left, right);
  const email = renderEmail("order_confirmation", {
    orderNumber: "KAPO-TEST",
    customerName: "Ada",
    customerEmail: "ada@example.com",
    currency: "usd",
    merchandiseSubtotalCents: 499,
    discountCents: 0,
    discountCode: null,
    shippingCents: 540,
    taxCents: 0,
    totalCents: 1039,
    refundedCents: 0,
    paymentStatus: "paid",
    productionStatus: "awaiting_production",
    shippingStatus: "quoted",
    carrier: "USPS",
    serviceName: "Ground Advantage",
    trackingNumber: null,
    trackingUrl: null,
    shipCity: "Philadelphia",
    shipState: "PA",
    items: [{ name: "Spore — Flat Keycap", quantity: 1, lineTotalCents: 499 }],
  });
  assert.match(email.subject, /KAPO-TEST/);
  assert.match(email.text, /Spore — Flat Keycap/);
  assert.match(email.text, /\$10\.39/);
  assert.equal(formatCents(1039), "$10.39");
  assert.equal(toE164Us("17173929139"), "+17173929139");
  assert.equal(toE164Us("(717) 392-9139"), "+17173929139");
  assert.equal(toE164Us("3929139"), null);
  assert.match(orderUpdateText("order_confirmation", { orderNumber: "KAPO-TEST", carrier: null, trackingUrl: null }) ?? "", /KAPO-TEST is confirmed/);
  assert.equal(orderUpdateText("tracking_update", { orderNumber: "KAPO-TEST", carrier: null, trackingUrl: null }), null);
  assert.equal(moneyStringToCents("5.40"), 540);
  assert.equal(await hashValue("same"), await hashValue("same"));
});

async function sign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
