import { clubEnabled, clubStore, redemptionEnabled, syncClubOrder } from "../club/server.ts";
import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import Stripe from "stripe";
import { getDb } from "../../db/index.ts";
import { ensureCommerceSchema } from "../../db/migrate.ts";
import {
  fulfillmentEvents,
  labelPurchaseAudit,
  labelSpendDays,
  notifications,
  orderItems,
  orders,
  payments,
  shipments,
  shippingLabels,
  shippingQuotes,
  trackingEvents,
  webhookEvents,
} from "../../db/schema.ts";
import { parseOrigin, shipToCountries, type ShippingAddress } from "./address.ts";
import { customerCanViewOrder, liveModeBlocked } from "./authz.ts";
import { assessPaidSession, checkoutSessionIdempotencyKey, planCheckoutContinuation, type SessionSnapshot } from "./checkout-session.ts";
import { applyDiscount, parseDiscountCodes } from "./discounts.ts";
import { deliverEmail } from "./email.ts";
import { deliverText, orderUpdateText } from "./sendblue.ts";
import type { EmailOrder } from "./email-template.ts";
import { commerceEnv, logCommerce, readEnv } from "./env.ts";
import {
  authorizeLabelPurchase,
  classifyPurchaseError,
  classifyTransaction,
  clearAttemptAllowed,
  confirmationMatches,
  dailyLimitMessage,
  labelPurchaseMode,
  priceAllowed,
  resolveLabelLimits,
  spendingDay,
} from "./label-guards.ts";
import { CommerceError } from "./errors.ts";
import { hashValue } from "./signatures.ts";
import { buildParcel, parcelRulesFromEnv, validateParcelOverride, type Parcel } from "./parcel.ts";
import { getMacropadLaunch } from "./launch.ts";
import { cartHash, merchandiseSubtotal, priceCart, TAX_CODE_TANGIBLE_GOODS, type PricedLine } from "./products.ts";
import { cheapestRate, customerShippingOptions, findRate, isQuoteExpired, normalizeRates, quoteExpiry, type ShippingRate } from "./rates.ts";
import { ShippoClient, type ShippoTransaction } from "./shippo.ts";
import {
  applyTrackingStatus,
  canMarkShipped,
  financeCounts,
  isAdminProductionStatus,
  isEmailTemplate,
  labelPurchaseResult,
  paymentSuccessEmails,
  planLabelPurchase,
  productionEmail,
  applyRefundSnapshot,
  summarizeFinance,
  type EmailTemplate,
} from "./status.ts";
import { publicSiteUrl, sender } from "../email/addresses.ts";
import { webhookClaimDecision } from "../email/policy.ts";

type Viewer = { userId: string; email: string } | null;

export async function createShippingQuote(input: {
  items: { productId?: string; quantity?: number }[];
  address: ShippingAddress;
  user: Viewer;
  ip: string;
  now?: Date;
}) {
  const settings = await ready();
  if (input.user && clubEnabled()) await clubStore().ensureProfile({ ...input.user, displayName: input.address.name });
  if (!settings.shippoToken) throw new CommerceError("Shippo is not configured yet. Add SHIPPO_TEST_API_KEY and set SHIPPO_MODE=test.", 503, "shippo_not_configured");
  const origin = parseOrigin(settings.originJson);
  if (!origin) throw new CommerceError("The shipping origin is not configured. Set KAPO_SHIPPING_ORIGIN.", 503, "origin_not_configured");
  if (!shipToCountries(settings.shipTo).includes(input.address.country)) {
    throw new CommerceError("KAPO currently ships within the United States.", 400, "international_unavailable");
  }
  const priced = priceCart(input.items, await getMacropadLaunch());
  if (!priced.ok) throw new CommerceError(priced.message, 400, "invalid_cart");
  const db = getDb();
  const ipHash = await hashValue(input.ip || "unknown");
  const now = input.now ?? new Date();
  const windowStart = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const recent = await db.select({ id: shippingQuotes.id }).from(shippingQuotes).where(and(eq(shippingQuotes.ipHash, ipHash), gte(shippingQuotes.createdAt, windowStart)));
  if (recent.length >= 8) throw new CommerceError("Too many shipping quotes. Wait a few minutes and try again.", 429, "rate_limited");

  const shippo = new ShippoClient(settings.shippoToken);
  await shippo.validateAddress(input.address);
  const parcel = buildParcel(priced.lines, parcelRulesFromEnv({
    KAPO_PARCEL_LENGTH_IN: readEnv("KAPO_PARCEL_LENGTH_IN"),
    KAPO_PARCEL_WIDTH_IN: readEnv("KAPO_PARCEL_WIDTH_IN"),
    KAPO_PARCEL_HEIGHT_IN: readEnv("KAPO_PARCEL_HEIGHT_IN"),
    KAPO_PACKAGING_WEIGHT_GRAMS: readEnv("KAPO_PACKAGING_WEIGHT_GRAMS"),
  }));
  let shipment;
  try {
    shipment = await shippo.createShipment({ from: origin, to: input.address, parcel });
  } catch (error) {
    if (error instanceof CommerceError) throw error;
    throw new CommerceError("Shipping rates are unavailable right now.", 502, "shipping_unavailable");
  }
  const rates = customerShippingOptions(normalizeRates(shipment.rates ?? [], settings.handlingFeeCents));
  if (!rates.length || !shipment.object_id) {
    throw new CommerceError("No tracked shipping rates were returned for that address. Try another address or check the carrier accounts in Shippo.", 409, "no_rates");
  }
  const id = crypto.randomUUID();
  const createdAt = now.toISOString();
  await db.insert(shippingQuotes).values({
    id,
    cartHash: await cartHash(priced.lines),
    customerUserId: input.user?.userId ?? null,
    customerEmail: input.address.email,
    customerName: input.address.name,
    addressJson: JSON.stringify(input.address),
    linesJson: JSON.stringify(priced.lines),
    parcelJson: JSON.stringify(parcel),
    ratesJson: JSON.stringify(rates),
    shippoShipmentId: shipment.object_id,
    merchandiseSubtotalCents: merchandiseSubtotal(priced.lines),
    handlingFeeCents: settings.handlingFeeCents,
    currency: settings.currency,
    productionDaysMin: Math.min(settings.productionDaysMin, settings.productionDaysMax),
    productionDaysMax: Math.max(settings.productionDaysMin, settings.productionDaysMax),
    ipHash,
    expiresAt: quoteExpiry(now, settings.quoteTtlSeconds),
    createdAt,
  });
  logCommerce("shipping_quote_created", { quoteId: id, rateCount: rates.length });
  return {
    quoteId: id,
    expiresAt: quoteExpiry(now, settings.quoteTtlSeconds),
    subtotalCents: merchandiseSubtotal(priced.lines),
    handlingFeeCents: settings.handlingFeeCents,
    productionDaysMin: Math.min(settings.productionDaysMin, settings.productionDaysMax),
    productionDaysMax: Math.max(settings.productionDaysMin, settings.productionDaysMax),
    parcel: { lengthIn: parcel.lengthIn, widthIn: parcel.widthIn, heightIn: parcel.heightIn, weightOz: parcel.weightOz },
    defaultRateId: cheapestRate(rates)?.id ?? null,
    rates: rates.map(publicRate),
  };
}

export async function createCheckout(input: { quoteId: string; rateId: string; discountCode?: string; redemptionId?: string; user?: Viewer; origin: string; now?: Date }) {
  if (clubEnabled()) return clubStore().withCheckoutLease(input.quoteId, () => createCheckoutInternal(input));
  return createCheckoutInternal(input);
}

async function createCheckoutInternal(input: { quoteId: string; rateId: string; discountCode?: string; redemptionId?: string; user?: Viewer; origin: string; now?: Date }) {
  const settings = await ready();
  if (!settings.stripeSecretKey || !settings.stripePublishableKey) {
    throw new CommerceError("Stripe is not configured yet. Add the test secret and publishable keys.", 503, "stripe_not_configured");
  }
  const liveBlock = liveModeBlocked(settings.stripeSecretKey, "stripe", settings.allowLivePayments);
  if (liveBlock) throw new CommerceError(liveBlock, 503, "live_payments_blocked");
  const db = getDb();
  const now = input.now ?? new Date();
  const [quote] = await db.select().from(shippingQuotes).where(eq(shippingQuotes.id, input.quoteId));
  if (!quote) throw new CommerceError("That shipping quote could not be found. Calculate shipping again.", 404, "quote_missing");
  if (isQuoteExpired(quote.expiresAt, now)) throw new CommerceError("That shipping quote expired. Calculate shipping again.", 409, "quote_expired");
  const rates = JSON.parse(quote.ratesJson) as ShippingRate[];
  const rate = findRate(rates, input.rateId);
  if (!rate) throw new CommerceError("Choose one of the quoted shipping options.", 400, "rate_missing");
  const lines = JSON.parse(quote.linesJson) as PricedLine[];
  const address = JSON.parse(quote.addressJson) as ShippingAddress;
  const [existing] = await db.select().from(orders).where(eq(orders.quoteId, quote.id));
  if (existing && existing.paymentStatus !== "pending") throw new CommerceError("This quote has already been used.", 409, "quote_used");
  if (quote.customerUserId && quote.customerUserId !== input.user?.userId) throw new CommerceError("Sign in to the account that requested shipping.", 403, "quote_owner");
  const orderId = existing?.id ?? quote.id;
  let discount = applyDiscount(quote.merchandiseSubtotalCents, input.discountCode, parseDiscountCodes(settings.discountCodes));
  if (!discount.ok) throw new CommerceError(discount.message, 400, "invalid_discount");
  if (input.redemptionId) {
    if (quote.currency !== "usd") throw new CommerceError("KAPO Club rewards currently apply to USD orders only.", 400, "reward_currency");
    if (!redemptionEnabled() || !input.user || quote.customerUserId !== input.user.userId) throw new CommerceError("This reward requires its verified KAPO Club account and an enabled reward checkout.", 403, "reward_unavailable");
    if (input.discountCode?.trim()) throw new CommerceError("KAPO Club rewards cannot be combined with another code.", 400, "reward_stacking");
    const reward = await clubStore().bindRedemption(input.redemptionId, input.user.userId, orderId, quote.merchandiseSubtotalCents);
    discount = { ok: true, code: `CLUB:${reward.id}`, discountCents: reward.value_cents };
  } else if (existing?.discountCode?.startsWith("CLUB:")) {
    throw new CommerceError("Continue with the reward attached to this checkout, or start a new shipping quote.", 409, "reward_attached");
  }
  const selectedRateId = rate.shippoRateId ?? rate.id;
  const previousSessionId = existing?.stripeCheckoutSessionId ?? null;
  if (existing?.stripeCheckoutSessionId && existing.paymentStatus === "pending") {
    const stripe = stripeClient(settings.stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(existing.stripeCheckoutSessionId);
    const plan = planCheckoutContinuation({
      status: session.status,
      paymentStatus: session.payment_status,
      hasClientSecret: Boolean(session.client_secret),
      sameTerms: existing.shippoRateId === selectedRateId && existing.discountCents === discount.discountCents && (existing.discountCode ?? null) === discount.code,
    });
    if (plan.action === "reuse" && session.client_secret) {
      return checkoutPayload(existing, session.client_secret);
    }
    if (plan.action === "wait") {
      throw new CommerceError("Payment for this order is already submitted. Refresh the confirmation page.", 409, "payment_submitted");
    }
    if (plan.action === "replace" && plan.expire) {
      await expireCheckoutSession(stripe, session.id);
    }
  }

  const orderNumber = existing?.orderNumber ?? createOrderNumber();
  const createdAt = existing?.createdAt ?? now.toISOString();
  const carrierCents = rate.carrierAmountCents;
  const provisionalTax = 0;
  const provisionalTotal = quote.merchandiseSubtotalCents - discount.discountCents + rate.amountCents + provisionalTax;
  const orderValues = {
    id: orderId,
    orderNumber,
    quoteId: quote.id,
    customerUserId: quote.customerUserId,
    customerEmail: quote.customerEmail,
    customerName: quote.customerName,
    currency: quote.currency,
    merchandiseSubtotalCents: quote.merchandiseSubtotalCents,
    discountCents: discount.discountCents,
    discountCode: discount.code,
    shippingCents: rate.amountCents,
    handlingFeeCents: quote.handlingFeeCents,
    carrierCents,
    taxCents: provisionalTax,
    totalCents: provisionalTotal,
    refundedCents: 0,
    paymentStatus: "pending",
    productionStatus: "pending_payment",
    shippingStatus: "quoted",
    shipName: address.name,
    shipPhone: address.phone,
    smsOptIn: address.smsUpdates ? 1 : 0,
    shipLine1: address.line1,
    shipLine2: address.line2,
    shipCity: address.city,
    shipState: address.state,
    shipPostalCode: address.postalCode,
    shipCountry: address.country,
    carrier: rate.provider,
    serviceName: rate.serviceName,
    serviceToken: rate.serviceToken,
    shippoRateId: rate.shippoRateId ?? rate.id,
    shippoShipmentId: quote.shippoShipmentId,
    parcelJson: quote.parcelJson,
    stripeCheckoutSessionId: existing?.stripeCheckoutSessionId ?? null,
    stripePaymentIntentId: existing?.stripePaymentIntentId ?? null,
    stripeTaxCalculationId: null,
    stripeTaxTransactionId: null,
    trackingNumber: null,
    trackingUrl: null,
    carrierTransitDays: rate.estimatedDays,
    durationTerms: rate.durationTerms,
    productionDaysMin: quote.productionDaysMin,
    productionDaysMax: quote.productionDaysMax,
    reviewReason: null,
    createdAt,
    updatedAt: now.toISOString(),
  };
  if (existing) {
    await db.update(orders).set(orderValues).where(eq(orders.id, orderId));
  } else {
    await db.batch([
    db.insert(orders).values(orderValues),
    db.insert(orderItems).values(lines.map((line) => ({
      id: crypto.randomUUID(),
      orderId,
      productId: line.productId,
      name: line.name,
      style: line.style,
      image: line.image,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: line.lineTotalCents,
    }))),
    db.insert(payments).values({
      id: crypto.randomUUID(),
      orderId,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeChargeId: null,
      amountCents: provisionalTotal,
      refundedCents: 0,
      status: "pending",
      createdAt,
      updatedAt: createdAt,
    }),
    db.insert(shipments).values({
      id: crypto.randomUUID(),
      orderId,
      shippoShipmentId: quote.shippoShipmentId,
      parcelJson: quote.parcelJson,
      ratesJson: quote.ratesJson,
      refreshedAt: null,
      createdAt,
      updatedAt: createdAt,
    }),
    ]);
  }

  const stripe = stripeClient(settings.stripeSecretKey);
  const session = await openCheckoutSession({
    stripe,
    settings,
    orderId,
    orderNumber,
    quoteId: quote.id,
    lines,
    address,
    rate,
    discount,
    origin: input.origin,
    idempotencyKey: checkoutSessionIdempotencyKey(orderId, selectedRateId, discount.discountCents, previousSessionId),
  });
  const pricedSession = await stripe.checkout.sessions.update(session.id, {
    collected_information: {
      shipping_details: {
        name: address.name,
        address: {
          line1: address.line1,
          line2: address.line2 || undefined,
          city: address.city,
          state: address.state,
          postal_code: address.postalCode,
          country: "US",
        },
      },
    },
  });
  const total = pricedSession.amount_total;
  const tax = pricedSession.total_details?.amount_tax ?? 0;
  if (total === null || !pricedSession.client_secret) {
    throw new CommerceError("Stripe did not return a payable total. Check Stripe Tax settings and try again.", 502, "stripe_total_missing");
  }
  if (pricedSession.total_details?.amount_shipping !== rate.amountCents) {
    throw new CommerceError("Stripe did not keep the selected shipping rate. Calculate shipping again.", 502, "shipping_mismatch");
  }
  if (pricedSession.amount_subtotal !== quote.merchandiseSubtotalCents
    || (pricedSession.total_details?.amount_discount ?? 0) !== discount.discountCents
    || total !== quote.merchandiseSubtotalCents - discount.discountCents + rate.amountCents + tax) {
    throw new CommerceError("Stripe did not preserve the verified merchandise and discount totals. Payment was not opened.", 502, "checkout_total_mismatch");
  }
  await db.update(orders).set({
    taxCents: tax,
    totalCents: total,
    stripeCheckoutSessionId: pricedSession.id,
    stripePaymentIntentId: intentId(pricedSession.payment_intent),
    updatedAt: now.toISOString(),
  }).where(eq(orders.id, orderId));
  await db.update(payments).set({
    amountCents: total,
    stripeCheckoutSessionId: pricedSession.id,
    stripePaymentIntentId: intentId(pricedSession.payment_intent),
    updatedAt: now.toISOString(),
  }).where(eq(payments.orderId, orderId));
  logCommerce("checkout_session_created", { orderId, taxEnabled: settings.taxEnabled });
  const [saved] = await db.select().from(orders).where(eq(orders.id, orderId));
  return checkoutPayload(saved ?? orderValues, pricedSession.client_secret);
}

async function openCheckoutSession(input: {
  stripe: Stripe;
  settings: ReturnType<typeof commerceEnv>;
  orderId: string;
  orderNumber: string;
  quoteId: string;
  lines: PricedLine[];
  address: ShippingAddress;
  rate: ShippingRate;
  discount: { code: string | null; discountCents: number };
  origin: string;
  idempotencyKey: string;
}) {
  try {
    const customer = await input.stripe.customers.create({
      email: input.address.email,
      name: input.address.name,
      phone: input.address.phone || undefined,
      address: stripeAddress(input.address),
      shipping: { name: input.address.name, phone: input.address.phone || undefined, address: stripeAddress(input.address) },
    }, { idempotencyKey: `kapo-customer-${input.orderId}` });
    let couponId: string | undefined;
    if (input.discount.discountCents > 0) {
      const coupon = await input.stripe.coupons.create({
        amount_off: input.discount.discountCents,
        currency: input.settings.currency,
        duration: "once",
        name: input.discount.code ?? "KAPO discount",
        max_redemptions: 1,
      }, { idempotencyKey: `kapo-coupon-${input.orderId}-${input.discount.discountCents}` });
      couponId = coupon.id;
    }
    return await input.stripe.checkout.sessions.create({
      ui_mode: "elements",
      mode: "payment",
      customer: customer.id,
      client_reference_id: input.orderId,
      return_url: `${input.origin}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      shipping_address_collection: { allowed_countries: ["US"] },
      permissions: { update_shipping_details: "server_only" },
      customer_update: { address: "never", shipping: "never", name: "never" },
      automatic_tax: { enabled: input.settings.taxEnabled },
      discounts: couponId ? [{ coupon: couponId }] : undefined,
      metadata: { order_id: input.orderId, order_number: input.orderNumber, quote_id: input.quoteId },
      payment_intent_data: {
        description: `KAPO ${input.orderNumber}`,
        receipt_email: input.address.email,
        metadata: { order_id: input.orderId, order_number: input.orderNumber },
      },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: input.rate.amountCents, currency: input.settings.currency },
          display_name: `${input.rate.tierLabel ? `${input.rate.tierLabel} · ` : ""}${input.rate.provider} ${input.rate.serviceName}`.slice(0, 100),
          tax_behavior: "exclusive",
          tax_code: "txcd_92010001",
          delivery_estimate: input.rate.estimatedDays && input.rate.estimatedDays > 0 ? {
            minimum: { unit: "business_day", value: Math.max(1, Math.round(input.rate.estimatedDays)) },
            maximum: { unit: "business_day", value: Math.max(1, Math.round(input.rate.estimatedDays)) },
          } : undefined,
        },
      }],
      line_items: input.lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: input.settings.currency,
          unit_amount: line.unitPriceCents,
          tax_behavior: "exclusive",
          product_data: {
            name: line.name,
            tax_code: TAX_CODE_TANGIBLE_GOODS,
            images: line.image.startsWith("/") ? [`${input.origin}${line.image}`] : undefined,
          },
        },
      })),
    }, { idempotencyKey: input.idempotencyKey });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      logCommerce("stripe_error", { code: error.code ?? "unknown", type: error.type, detail: error.message.slice(0, 240) });
      if (/tax/i.test(`${error.code ?? ""} ${error.message}`)) {
        throw new CommerceError("Stripe Tax is not ready for this account. Finish registration in Stripe, or set STRIPE_TAX_ENABLED=false for a tax-free test.", 503, "tax_not_configured");
      }
      throw new CommerceError("Payment could not be started.", 502, "stripe_error");
    }
    throw error;
  }
}

export async function applyStripeWebhook(event: Stripe.Event) {
  const settings = await ready();
  const claim = await claimWebhook("stripe", event.id);
  if (claim === "duplicate") return { duplicate: true };
  if (claim === "in_progress") {
    throw new CommerceError("This Stripe event is already being processed.", 409, "webhook_in_progress");
  }
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      await withSessionCheckoutLease(session, () => settleCheckoutSession(session));
    } else if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const outcome = event.type === "checkout.session.expired" ? "expired" as const : "failed" as const;
      await withSessionCheckoutLease(session, () => failCheckoutSession(session, outcome));
    } else if (event.type === "charge.refunded") {
      await applyRefund(event.data.object as Stripe.Charge, settings.stripeSecretKey);
    }
    await finishWebhook("stripe", event.id, "processed");
    return { duplicate: false };
  } catch (error) {
    await finishWebhook("stripe", event.id, "failed");
    throw error;
  }
}

async function withSessionCheckoutLease<T>(session: Stripe.Checkout.Session, work: () => Promise<T>) {
  if (!clubEnabled() || !session.metadata?.order_id) return work();
  const [order] = await getDb().select().from(orders).where(eq(orders.id, session.metadata.order_id));
  if (!order) throw new CommerceError("Order is not ready for this Stripe event.", 409, "order_not_ready");
  // Replacement-session expiry must not release a reward while a new session is opening.
  // The work re-reads the order under the same quote lease used by checkout creation.
  return clubStore().withCheckoutLease(order.quoteId, work);
}

async function settleCheckoutSession(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new CommerceError("Order is not ready for this Stripe event.", 409, "order_not_ready");
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
    await markReview(order.id, "A different Checkout Session was paid for this order.");
    return;
  }
  const snapshot: SessionSnapshot = {
    paymentStatus: session.payment_status ?? "unpaid",
    amountSubtotal: session.amount_subtotal,
    amountTotal: session.amount_total,
    amountShipping: session.total_details?.amount_shipping ?? null,
    amountDiscount: session.total_details?.amount_discount ?? null,
    amountTax: session.total_details?.amount_tax ?? null,
    shipping: sessionShipping(session),
  };
  const decision = assessPaidSession(order, snapshot);
  if (decision.action === "ignore") return;
  const now = new Date().toISOString();
  const paymentIntent = intentId(session.payment_intent);
  if (decision.action === "review") {
    await markReview(order.id, decision.reason);
    await db.update(orders).set({ stripePaymentIntentId: paymentIntent, updatedAt: now }).where(eq(orders.id, order.id));
    return;
  }
  const updated = await db.update(orders).set({
    paymentStatus: "paid",
    productionStatus: "awaiting_production",
    taxCents: decision.taxCents,
    totalCents: decision.totalCents,
    stripePaymentIntentId: paymentIntent,
    updatedAt: now,
  }).where(and(eq(orders.id, order.id), eq(orders.paymentStatus, "pending"))).returning();
  if (!updated.length) {
    const [current] = await db.select().from(orders).where(eq(orders.id, order.id));
    if (current && (current.paymentStatus === "paid" || current.paymentStatus === "partially_refunded")) {
      await syncClubOrder(current.id);
      await sendPaymentEmails(current);
    }
    return;
  }
  await db.update(payments).set({ status: "paid", stripePaymentIntentId: paymentIntent, amountCents: decision.totalCents, updatedAt: now }).where(eq(payments.orderId, order.id));
  await recordEvent(order.id, "payment", "pending", "paid", "Stripe webhook", "stripe");
  await recordEvent(order.id, "production", order.productionStatus, "awaiting_production", "Payment confirmed", "stripe");
  await syncClubOrder(order.id);
  await sendPaymentEmails(updated[0]);
  logCommerce("order_paid", { orderId: order.id });
}

async function sendPaymentEmails(order: typeof orders.$inferSelect) {
  for (const template of paymentSuccessEmails()) {
    await notify(order, template, `${template}:${order.id}`);
  }
}

function sessionShipping(session: Stripe.Checkout.Session): SessionSnapshot["shipping"] {
  const address = session.collected_information?.shipping_details?.address;
  if (!address?.line1 || !address.city || !address.state || !address.postal_code || !address.country) return null;
  return { line1: address.line1, city: address.city, state: address.state, postalCode: address.postal_code, country: address.country };
}

async function failCheckoutSession(session: Stripe.Checkout.Session, outcome: "failed" | "expired") {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new CommerceError("Order is not ready for this Stripe event.", 409, "order_not_ready");
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) return;
  if (order.paymentStatus === "pending" && clubEnabled()) await clubStore().releaseOrder(order.id);
  if (outcome === "expired") return;
  const now = new Date().toISOString();
  const updated = await db.update(orders).set({ paymentStatus: "failed", updatedAt: now }).where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "pending"))).returning();
  if (updated.length) {
    await db.update(payments).set({ status: "failed", updatedAt: now }).where(eq(payments.orderId, orderId));
    await recordEvent(orderId, "payment", "pending", "failed", "Stripe payment failed", "stripe");
    await notify(updated[0], "payment_failed", `payment_failed:${orderId}`);
  }
}

async function applyRefund(charge: Stripe.Charge, stripeKey: string) {
  const paymentIntent = intentId(charge.payment_intent);
  if (!paymentIntent) return;
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.stripePaymentIntentId, paymentIntent));
  if (!order) throw new CommerceError("Refund arrived before the order payment was recorded.", 409, "refund_before_payment");
  const snapshot = applyRefundSnapshot(order, charge.amount_refunded ?? 0);
  if (snapshot.action === "retry") {
    throw new CommerceError("Refund arrived before Stripe confirmed the payment.", 409, "refund_before_payment");
  }
  if (snapshot.action === "ignore") return;
  const { refundedCents, status } = snapshot;
  const now = new Date().toISOString();
  await db.update(orders).set({ refundedCents, paymentStatus: status, updatedAt: now }).where(and(eq(orders.id, order.id), lte(orders.refundedCents, refundedCents)));
  await db.update(payments).set({ refundedCents, status, stripeChargeId: charge.id, updatedAt: now }).where(and(eq(payments.orderId, order.id), lte(payments.refundedCents, refundedCents)));
  await syncClubOrder(order.id);
  await recordEvent(order.id, "payment", order.paymentStatus, status, "Stripe refund", "stripe");
  if (refundedCents > 0) await notify({ ...order, refundedCents, paymentStatus: status }, "refund_confirmation", `refund:${charge.id}:${refundedCents}`);
  if (status === "refunded" && order.stripeTaxTransactionId && stripeKey) {
    try {
      await stripeClient(stripeKey).tax.transactions.createReversal({
        mode: "full",
        original_transaction: order.stripeTaxTransactionId,
        reference: `${order.orderNumber}-refund`,
      }, { idempotencyKey: `kapo-tax-reversal-${order.id}` });
    } catch (error) {
      logCommerce("tax_reversal_failed", { orderId: order.id, code: error instanceof Stripe.errors.StripeError ? error.code ?? "unknown" : "unknown" });
    }
  }
}

export async function applyShippoWebhook(payload: { event?: string; data?: Record<string, unknown> }) {
  await ready();
  const eventName = payload.event ?? "unknown";
  const data = payload.data ?? {};
  const trackingNumber = String(data.tracking_number ?? "");
  const tracking = data.tracking_status;
  const trackingObject = tracking && typeof tracking === "object" ? tracking as { status?: string; status_date?: string } : undefined;
  const status = String(trackingObject?.status ?? (typeof tracking === "string" ? tracking : data.status ?? ""));
  const occurredAt = String(trackingObject?.status_date ?? "");
  const transactionId = String(data.object_id ?? data.transaction ?? trackingNumber);
  const eventId = await hashValue(`${eventName}:${transactionId}:${trackingNumber}:${status}:${occurredAt}`);
  const claim = await claimWebhook("shippo", eventId);
  if (claim === "duplicate") return { duplicate: true };
  if (claim === "in_progress") {
    throw new CommerceError("This Shippo event is already being processed.", 409, "webhook_in_progress");
  }
  try {
    if (eventName === "track_updated" && trackingNumber) await applyTracking(trackingNumber, data);
    if ((eventName === "transaction_created" || eventName === "transaction_updated") && data.status === "SUCCESS") {
      await rememberTransaction(data as unknown as ShippoTransaction);
    }
    await finishWebhook("shippo", eventId, "processed");
    return { duplicate: false };
  } catch (error) {
    await finishWebhook("shippo", eventId, "failed");
    throw error;
  }
}

async function applyTracking(trackingNumber: string, data: Record<string, unknown>) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.trackingNumber, trackingNumber));
  if (!order) return;
  const tracking = (data.tracking_status ?? {}) as { status?: string; status_details?: string; status_date?: string; substatus?: { code?: string } };
  const status = tracking.status ?? "UNKNOWN";
  const occurredAt = tracking.status_date ?? new Date().toISOString();
  const dedupeKey = await hashValue(`${order.id}:${trackingNumber}:${status}:${tracking.substatus?.code ?? ""}:${occurredAt}`);
  try {
    await db.insert(trackingEvents).values({
      id: crypto.randomUUID(),
      orderId: order.id,
      trackingNumber,
      status,
      statusDetails: tracking.status_details ?? "",
      occurredAt,
      dedupeKey,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = errorText(error);
    if (!/unique/i.test(message)) throw error;
    // Continue unfinished state/reward/notification work when a provider retries.
  }
  const next = applyTrackingStatus(order.shippingStatus as "quoted", order.productionStatus as "pending_payment", status, tracking.substatus?.code ?? "");
  const now = new Date().toISOString();
  await db.update(orders).set({
    shippingStatus: next.shippingStatus,
    productionStatus: next.productionStatus ?? order.productionStatus,
    updatedAt: now,
  }).where(eq(orders.id, order.id));
  if (next.productionStatus && next.productionStatus !== order.productionStatus) {
    await recordEvent(order.id, "production", order.productionStatus, next.productionStatus, status, "shippo");
  }
  await recordEvent(order.id, "shipping", order.shippingStatus, next.shippingStatus, tracking.status_details ?? status, "shippo");
  await syncClubOrder(order.id);
  const saved = { ...order, shippingStatus: next.shippingStatus, productionStatus: next.productionStatus ?? order.productionStatus };
  for (const template of next.emails) {
    await notify(saved, template, `${template}:${order.id}:${status}:${occurredAt}`, tracking.status_details ?? status);
  }
}

async function rememberTransaction(transaction: ShippoTransaction) {
  if (!transaction.tracking_number) return;
  const db = getDb();
  const [label] = transaction.object_id
    ? await db.select().from(shippingLabels).where(eq(shippingLabels.shippoTransactionId, transaction.object_id))
    : [];
  if (!label) return;
  await db.update(orders).set({
    trackingNumber: transaction.tracking_number,
    trackingUrl: transaction.tracking_url_provider ?? null,
    updatedAt: new Date().toISOString(),
  }).where(and(eq(orders.id, label.orderId), sql`${orders.trackingNumber} is null`));
}

export async function updateProduction(orderId: string, status: string, actor: string) {
  await ready();
  if (!isAdminProductionStatus(status)) throw new CommerceError("That production status cannot be set from the dashboard.", 400, "invalid_status");
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new CommerceError("Order not found.", 404, "order_missing");
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") {
    throw new CommerceError("Production starts after Stripe confirms payment.", 409, "not_paid");
  }
  const now = new Date().toISOString();
  await db.update(orders).set({ productionStatus: status, updatedAt: now }).where(eq(orders.id, orderId));
  await recordEvent(orderId, "production", order.productionStatus, status, "Admin update", actor);
  const template = productionEmail(status);
  if (template) await notify({ ...order, productionStatus: status }, template, `${template}:${orderId}`);
  return getAdminOrder(orderId);
}

export async function refreshLabelRates(orderId: string, parcelInput: { lengthIn?: number; widthIn?: number; heightIn?: number; weightOz?: number }) {
  const settings = await ready();
  const origin = requireShippo(settings);
  const parcelResult = validateParcelOverride(parcelInput);
  if (!parcelResult.ok) throw new CommerceError(parcelResult.message, 400, "invalid_parcel");
  const order = await requireOrder(orderId);
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") {
    throw new CommerceError("Labels can be refreshed after payment is confirmed.", 409, "not_paid");
  }
  const address = orderAddress(order);
  const shippo = new ShippoClient(settings.shippoToken);
  const shipment = await shippo.createShipment({ from: origin, to: address, parcel: parcelResult.parcel });
  const rates = normalizeRates(shipment.rates ?? [], 0);
  if (!rates.length || !shipment.object_id) throw new CommerceError("No tracked rates came back for the confirmed parcel.", 409, "no_rates");
  const now = new Date().toISOString();
  const db = getDb();
  const [existingShipment] = await db.select().from(shipments).where(eq(shipments.orderId, orderId));
  const shipmentValues = { shippoShipmentId: shipment.object_id, parcelJson: JSON.stringify(parcelResult.parcel), ratesJson: JSON.stringify(rates), refreshedAt: now, updatedAt: now };
  if (existingShipment) {
    await db.update(shipments).set(shipmentValues).where(eq(shipments.orderId, orderId));
  } else {
    await db.insert(shipments).values({ id: crypto.randomUUID(), orderId, ...shipmentValues, createdAt: now });
  }
  return { rates: rates.map(publicRate), parcel: parcelResult.parcel, refreshedAt: now, safeguards: await labelSafeguardSnapshot() };
}

type LabelPurchaseRequest = {
  rateId: string;
  confirmed: boolean;
  amountCents: number;
  carrier: string;
  serviceName: string;
};

export async function purchaseLabel(orderId: string, input: LabelPurchaseRequest, actor: string, source: string) {
  const settings = await ready();
  const auth = authorizeLabelPurchase({ source, actor, adminEmails: settings.adminEmails, devBypass: settings.adminDevBypass });
  if (!auth.ok) throw new CommerceError(auth.message, 403, "label_forbidden");
  if (settings.liveLabelsBlocked) {
    throw new CommerceError("SHIPPO_MODE=live is set, but live label purchasing stays off until KAPO_ALLOW_LIVE_LABELS=true. Keep SHIPPO_MODE=test for test labels.", 503, "live_labels_blocked");
  }
  requireShippo(settings);
  const mode = labelPurchaseMode(settings.shippoToken, settings.allowLiveLabels);
  const testMode = mode === "test";
  const order = await requireOrder(orderId);
  const liveBlock = liveModeBlocked(settings.shippoToken, "shippo", settings.allowLiveLabels);
  if (liveBlock) {
    await auditLabel({ orderId, actor, action: "blocked", testMode, detail: "live_labels_blocked" });
    throw new CommerceError(liveBlock, 503, "live_labels_blocked");
  }
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") {
    throw new CommerceError("Labels can be purchased after payment is confirmed.", 409, "not_paid");
  }
  const db = getDb();
  const [shipment] = await db.select().from(shipments).where(eq(shipments.orderId, orderId));
  const rates = JSON.parse(shipment?.ratesJson || "[]") as ShippingRate[];
  const rate = findRate(rates, input.rateId);
  if (!shipment?.refreshedAt || !rate) throw new CommerceError("Refresh carrier rates for the final parcel, then choose a service.", 409, "rates_not_refreshed");
  if (Date.now() - Date.parse(shipment.refreshedAt) > 24 * 60 * 60 * 1000) {
    throw new CommerceError("Those carrier rates expired. Refresh them before buying a label.", 409, "rates_expired");
  }
  const confirmation = confirmationMatches(rate, input);
  if (!confirmation.ok) {
    await auditLabel({
      orderId,
      actor,
      action: "blocked",
      rateId: input.rateId,
      carrier: input.carrier,
      serviceName: input.serviceName,
      amountCents: Number.isInteger(input.amountCents) ? input.amountCents : null,
      testMode,
      detail: "confirmation_mismatch",
    });
    throw new CommerceError(confirmation.message, 400, "confirmation_required");
  }
  const limits = resolveLabelLimits(settings.labelMaxCents, settings.labelDailyMaxCents, settings.labelLimitsOverride);
  const price = priceAllowed(rate.carrierAmountCents, limits.maxLabelCents);
  if (!price.ok) {
    await auditLabel({ orderId, actor, action: "blocked", rateId: rate.id, carrier: rate.provider, serviceName: rate.serviceName, amountCents: rate.carrierAmountCents, testMode, detail: "price_cap" });
    throw new CommerceError(price.message, 409, "label_price");
  }
  const existingLabels = await db.select().from(shippingLabels).where(eq(shippingLabels.orderId, orderId));
  const plan = planLabelPurchase(existingLabels, new Date());
  if (!plan.ok) {
    await auditLabel({ orderId, actor, action: "blocked", rateId: rate.id, carrier: rate.provider, serviceName: rate.serviceName, amountCents: rate.carrierAmountCents, testMode, detail: "open_label" });
    throw new CommerceError(plan.message, 409, "label_blocked");
  }
  const day = spendingDay(new Date());
  const reserved = await reserveLabelSpend(day, rate.carrierAmountCents, limits.dailyMaxCents);
  if (!reserved) {
    await auditLabel({ orderId, actor, action: "blocked", rateId: rate.id, carrier: rate.provider, serviceName: rate.serviceName, amountCents: rate.carrierAmountCents, testMode, detail: "daily_limit" });
    throw new CommerceError(dailyLimitMessage(limits.dailyMaxCents), 409, "label_daily_limit");
  }
  const labelId = crypto.randomUUID();
  const now = new Date().toISOString();
  const shippoRateId = rate.shippoRateId ?? rate.id;
  try {
    await db.insert(shippingLabels).values({
      id: labelId,
      orderId,
      shipmentId: shipment.id,
      shippoTransactionId: null,
      shippoRateId,
      status: "pending",
      carrier: rate.provider,
      serviceName: rate.serviceName,
      amountCents: rate.carrierAmountCents,
      labelUrl: null,
      trackingNumber: null,
      trackingUrl: null,
      errorMessage: null,
      spendDay: day,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    await releaseLabelSpend(day, rate.carrierAmountCents);
    const message = errorText(error);
    if (/unique/i.test(message)) throw new CommerceError("A label purchase is already active for this order.", 409, "label_blocked");
    throw error;
  }
  try {
    await auditLabel({ orderId, actor, action: "attempt", rateId: shippoRateId, carrier: rate.provider, serviceName: rate.serviceName, amountCents: rate.carrierAmountCents, testMode, detail: labelId });
  } catch {
    await db.update(shippingLabels).set({ status: "failed", errorMessage: "Purchase was not sent.", updatedAt: new Date().toISOString() }).where(eq(shippingLabels.id, labelId));
    await releaseLabelSpend(day, rate.carrierAmountCents);
    throw new CommerceError("The purchase was not sent because the audit log could not be written.", 503, "audit_failed");
  }
  let transaction: ShippoTransaction;
  try {
    transaction = await new ShippoClient(settings.shippoToken).purchaseLabel(shippoRateId, order.orderNumber, `kapo-label-${labelId}`);
  } catch (error) {
    const kind = classifyPurchaseError(error instanceof CommerceError ? { status: error.status, code: error.code } : null);
    if (kind === "uncertain") {
      await finishUncertainLabel(labelId, orderId, actor, testMode, shippoRateId, rate, null, "Shippo did not confirm the purchase. Check Shippo before trying again.");
      throw new CommerceError("Shippo did not confirm whether the label was purchased. Check Shippo, then clear the attempt only if no label was sold.", 502, "label_uncertain");
    }
    await db.update(shippingLabels).set({ status: "failed", errorMessage: "Shippo rejected the purchase.", updatedAt: new Date().toISOString() }).where(eq(shippingLabels.id, labelId));
    await releaseLabelSpend(day, rate.carrierAmountCents);
    await auditLabel({ orderId, actor, action: "failed", rateId: shippoRateId, carrier: rate.provider, serviceName: rate.serviceName, amountCents: rate.carrierAmountCents, testMode, detail: "shippo_rejected" });
    if (error instanceof CommerceError) throw error;
    throw new CommerceError("The label purchase failed. The order was not marked shipped.", 502, "label_failed");
  }
  const outcome = classifyTransaction(transaction);
  const finished = new Date().toISOString();
  if (outcome !== "succeeded") {
    if (outcome === "uncertain") {
      await finishUncertainLabel(labelId, orderId, actor, testMode, shippoRateId, rate, transaction, transaction.messages?.map((message) => message.text).filter(Boolean).join(" ") || "Shippo did not confirm the purchase.");
      throw new CommerceError("Shippo did not confirm whether the label was purchased. Check Shippo, then clear the attempt only if no label was sold.", 502, "label_uncertain");
    }
    await db.update(shippingLabels).set({
      status: "failed",
      shippoTransactionId: transaction.object_id ?? null,
      errorMessage: transaction.messages?.map((message) => message.text).filter(Boolean).join(" ") || "Label purchase failed",
      updatedAt: finished,
    }).where(eq(shippingLabels.id, labelId));
    await releaseLabelSpend(day, rate.carrierAmountCents);
    await auditLabel({ orderId, actor, action: "failed", rateId: shippoRateId, carrier: rate.provider, serviceName: rate.serviceName, amountCents: rate.carrierAmountCents, testMode, shippoTransactionId: transaction.object_id ?? null, detail: "shippo_error" });
    throw new CommerceError("Shippo did not return a label. The order was not marked shipped.", 502, "label_failed");
  }
  const result = labelPurchaseResult(true);
  await db.update(shippingLabels).set({
    status: "succeeded",
    shippoTransactionId: transaction.object_id ?? null,
    labelUrl: transaction.label_url ?? null,
    trackingNumber: transaction.tracking_number ?? null,
    trackingUrl: transaction.tracking_url_provider ?? null,
    errorMessage: null,
    updatedAt: finished,
  }).where(eq(shippingLabels.id, labelId));
  await db.update(orders).set({
    shippingStatus: result.shippingStatus,
    carrier: rate.provider,
    serviceName: rate.serviceName,
    serviceToken: rate.serviceToken,
    shippoRateId,
    shippoShipmentId: shipment.shippoShipmentId,
    trackingNumber: transaction.tracking_number ?? null,
    trackingUrl: transaction.tracking_url_provider ?? null,
    updatedAt: finished,
  }).where(eq(orders.id, orderId));
  await recordEvent(orderId, "shipping", order.shippingStatus, result.shippingStatus, "Label purchased", actor);
  try {
    await auditLabel({ orderId, actor, action: "succeeded", rateId: shippoRateId, carrier: rate.provider, serviceName: rate.serviceName, amountCents: rate.carrierAmountCents, testMode, shippoTransactionId: transaction.object_id ?? null, detail: labelId });
  } catch {
    logCommerce("label_audit_failed", { orderId, action: "succeeded" });
  }
  logCommerce("label_purchased", { orderId, shipped: result.shipped, amountCents: rate.carrierAmountCents, testMode });
  return getAdminOrder(orderId);
}

export async function clearLabelAttempt(orderId: string, input: { confirmed: boolean; orderNumber: string }, actor: string, source: string) {
  const settings = await ready();
  const auth = authorizeLabelPurchase({ source, actor, adminEmails: settings.adminEmails, devBypass: settings.adminDevBypass });
  if (!auth.ok) throw new CommerceError(auth.message, 403, "label_forbidden");
  const order = await requireOrder(orderId);
  const allowed = clearAttemptAllowed(order.orderNumber, input.orderNumber, input.confirmed);
  if (!allowed.ok) throw new CommerceError(allowed.message, 400, "confirmation_required");
  const db = getDb();
  const labels = await db.select().from(shippingLabels).where(eq(shippingLabels.orderId, orderId));
  const open = labels.find((label) => label.status === "pending" || label.status === "uncertain");
  if (!open) throw new CommerceError("There is no unfinished label attempt to clear.", 409, "label_missing");
  const now = new Date().toISOString();
  const updated = await db.update(shippingLabels).set({ status: "cleared", errorMessage: "Cleared by admin after a Shippo check", updatedAt: now }).where(and(eq(shippingLabels.id, open.id), or(eq(shippingLabels.status, "pending"), eq(shippingLabels.status, "uncertain")))).returning();
  if (!updated.length) throw new CommerceError("That attempt was already cleared.", 409, "label_blocked");
  await releaseLabelSpend(open.spendDay, open.amountCents);
  await auditLabel({
    orderId,
    actor,
    action: "cleared",
    rateId: open.shippoRateId,
    carrier: open.carrier,
    serviceName: open.serviceName,
    amountCents: open.amountCents,
    testMode: labelPurchaseMode(settings.shippoToken, settings.allowLiveLabels) === "test",
    shippoTransactionId: open.shippoTransactionId,
    detail: open.status,
  });
  await recordEvent(orderId, "shipping", order.shippingStatus, order.shippingStatus, "Unfinished label attempt cleared after a Shippo check", actor);
  return getAdminOrder(orderId);
}

export async function markShipped(orderId: string, actor: string) {
  await ready();
  const order = await requireOrder(orderId);
  if (order.shippingStatus === "shipped" && order.productionStatus === "shipped") {
    await syncClubOrder(orderId);
    await notify(order, "shipment_confirmation", `shipment_confirmation:${orderId}`);
    return getAdminOrder(orderId);
  }
  const decision = canMarkShipped(order);
  if (!decision.ok) throw new CommerceError(decision.message, 409, "cannot_ship");
  const now = new Date().toISOString();
  await getDb().update(orders).set({ shippingStatus: "shipped", productionStatus: "shipped", updatedAt: now }).where(eq(orders.id, orderId));
  await recordEvent(orderId, "shipping", order.shippingStatus, "shipped", "Handed to carrier", actor);
  await recordEvent(orderId, "production", order.productionStatus, "shipped", "Handed to carrier", actor);
  await syncClubOrder(orderId);
  await notify({ ...order, shippingStatus: "shipped", productionStatus: "shipped" }, "shipment_confirmation", `shipment_confirmation:${orderId}`);
  return getAdminOrder(orderId);
}

export async function voidLabel(orderId: string, actor: string, source: string) {
  const settings = await ready();
  const auth = authorizeLabelPurchase({ source, actor, adminEmails: settings.adminEmails, devBypass: settings.adminDevBypass });
  if (!auth.ok) throw new CommerceError(auth.message, 403, "label_forbidden");
  requireShippo(settings);
  const db = getDb();
  const [label] = await db.select().from(shippingLabels).where(and(eq(shippingLabels.orderId, orderId), eq(shippingLabels.status, "succeeded")));
  if (!label?.shippoTransactionId) throw new CommerceError("There is no purchased label to void.", 409, "label_missing");
  const order = await requireOrder(orderId);
  if (order.shippingStatus === "delivered") throw new CommerceError("A delivered shipment cannot be voided here.", 409, "already_delivered");
  let refund;
  try {
    refund = await new ShippoClient(settings.shippoToken).voidLabel(label.shippoTransactionId);
  } catch (error) {
    if (error instanceof CommerceError) throw error;
    throw new CommerceError("Shippo did not void the label. The order is still not marked delivered.", 502, "void_failed");
  }
  const accepted = refund.status === "SUCCESS" || refund.status === "QUEUED" || refund.status === "PENDING";
  if (!accepted) throw new CommerceError("Shippo did not accept the label refund. The order was not changed.", 502, "void_failed");
  const now = new Date().toISOString();
  const status = refund.status === "SUCCESS" ? "voided" : "void_requested";
  const updated = await db.update(shippingLabels).set({ status, updatedAt: now }).where(and(eq(shippingLabels.id, label.id), eq(shippingLabels.status, "succeeded"))).returning();
  if (!updated.length) throw new CommerceError("That label was already changed.", 409, "label_blocked");
  if (status === "voided") await releaseLabelSpend(label.spendDay, label.amountCents);
  await db.update(orders).set({ shippingStatus: status, updatedAt: now }).where(eq(orders.id, orderId));
  await recordEvent(orderId, "shipping", order.shippingStatus, status, "Label void requested", actor);
  await auditLabel({
    orderId,
    actor,
    action: status === "voided" ? "voided" : "void_requested",
    rateId: label.shippoRateId,
    carrier: label.carrier,
    serviceName: label.serviceName,
    amountCents: label.amountCents,
    testMode: labelPurchaseMode(settings.shippoToken, settings.allowLiveLabels) === "test",
    shippoTransactionId: label.shippoTransactionId,
    detail: refund.status ?? null,
  });
  return getAdminOrder(orderId);
}

export async function refundOrder(orderId: string, actor: string, amountCents?: number) {
  const settings = await ready();
  if (!settings.stripeSecretKey) throw new CommerceError("Stripe is not configured.", 503, "stripe_not_configured");
  const order = await requireOrder(orderId);
  if (!order.stripePaymentIntentId || (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded")) {
    throw new CommerceError("This order does not have a refundable Stripe payment.", 409, "not_refundable");
  }
  const remaining = order.totalCents - order.refundedCents;
  const amount = amountCents ?? remaining;
  if (!Number.isInteger(amount) || amount < 1 || amount > remaining) {
    throw new CommerceError("Enter a refund amount up to the remaining balance.", 400, "invalid_refund");
  }
  try {
    await stripeClient(settings.stripeSecretKey).refunds.create({
      payment_intent: order.stripePaymentIntentId,
      amount,
    }, { idempotencyKey: `kapo-refund-${orderId}-${order.refundedCents}-${amount}` });
  } catch (error) {
    logCommerce("refund_failed", { orderId, code: error instanceof Stripe.errors.StripeError ? error.code ?? "unknown" : "unknown" });
    throw new CommerceError("Stripe did not complete the refund.", 502, "refund_failed");
  }
  await recordEvent(orderId, "payment", order.paymentStatus, "refund_pending", `Refund requested by ${actor}`, actor);
  return getAdminOrder(orderId);
}

export async function getOrderBySession(sessionId: string) {
  await ready();
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;
  const [order] = await getDb().select().from(orders).where(eq(orders.stripeCheckoutSessionId, sessionId));
  if (!order) return null;
  const items = await getDb().select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return toCustomerOrder(order, items);
}

export async function listCustomerOrders(user: { userId: string; email: string }) {
  await ready();
  const rows = await getDb().select().from(orders).where(eq(orders.customerUserId, user.userId)).orderBy(desc(orders.createdAt));
  const visible = rows.filter((order) => customerCanViewOrder(order, user));
  const ids = visible.map((order) => order.id);
  const items = ids.length ? await getDb().select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
  return visible.map((order) => {
    const lines = items.filter((item) => item.orderId === order.id);
    const first = lines[0];
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
      productionStatus: order.productionStatus,
      shippingStatus: order.shippingStatus,
      createdAt: order.createdAt,
      previewImage: first?.image ?? null,
      previewName: first?.name ?? "Order",
      trackingUrl: order.trackingUrl,
      itemCount: lines.reduce((count, item) => count + item.quantity, 0),
    };
  });
}

export async function getCustomerOrder(orderNumber: string, user: { userId: string; email: string }) {
  await ready();
  const [order] = await getDb().select().from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!order || !customerCanViewOrder(order, user)) return null;
  const items = await getDb().select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return toCustomerOrder(order, items);
}

export async function dashboard() {
  await ready();
  const db = getDb();
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
  const financeRows = await db.select({
    paymentStatus: orders.paymentStatus,
    productionStatus: orders.productionStatus,
    shippingStatus: orders.shippingStatus,
    totalCents: orders.totalCents,
    refundedCents: orders.refundedCents,
    taxCents: orders.taxCents,
    shippingCents: orders.shippingCents,
  }).from(orders);
  const [labelRow] = await db.select({ cost: sql<number>`coalesce(sum(${shippingLabels.amountCents}), 0)` }).from(shippingLabels).where(eq(shippingLabels.status, "succeeded"));
  const ids = rows.map((order) => order.id);
  const itemRows = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
  const finance = summarizeFinance(financeRows, Number(labelRow?.cost ?? 0));
  const counts = financeCounts(financeRows);
  const queued = await db.select({ id: notifications.id }).from(notifications).where(eq(notifications.status, "queued"));
  return {
    orders: rows.map((order) => {
      const lines = itemRows.filter((item) => item.orderId === order.id);
      return {
        ...toAdminListItem(order),
        previewImage: lines[0]?.image ?? null,
        itemCount: lines.reduce((count, item) => count + item.quantity, 0),
      };
    }),
    finance: { ...finance, ...counts },
    queuedEmails: queued.length,
  };
}

export async function getAdminOrder(orderId: string) {
  await ready();
  const order = await requireOrder(orderId);
  const db = getDb();
  const [items, labels, events, tracking, shipment, labelAudit, safeguards] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(shippingLabels).where(eq(shippingLabels.orderId, orderId)).orderBy(desc(shippingLabels.createdAt)),
    db.select().from(fulfillmentEvents).where(eq(fulfillmentEvents.orderId, orderId)).orderBy(desc(fulfillmentEvents.createdAt)),
    db.select().from(trackingEvents).where(eq(trackingEvents.orderId, orderId)).orderBy(desc(trackingEvents.occurredAt)),
    db.select().from(shipments).where(eq(shipments.orderId, orderId)),
    db.select().from(labelPurchaseAudit).where(eq(labelPurchaseAudit.orderId, orderId)).orderBy(desc(labelPurchaseAudit.createdAt)).limit(12),
    labelSafeguardSnapshot(),
  ]);
  return {
    ...toAdminListItem(order),
    items,
    labels,
    events,
    tracking,
    labelAudit,
    safeguards,
    shipment: shipment[0] ? { ...shipment[0], rates: JSON.parse(shipment[0].ratesJson) as ShippingRate[], parcel: JSON.parse(shipment[0].parcelJson) as Parcel } : null,
    parcel: JSON.parse(order.parcelJson) as Parcel,
  };
}

async function notify(order: typeof orders.$inferSelect, template: EmailTemplate, dedupeKey: string, detail?: string) {
  if (clubEnabled() && order.customerUserId && ["production_started", "order_ready_to_ship", "tracking_update", "out_for_delivery"].includes(template)) {
    const profile = await clubStore().statement("SELECT order_emails FROM club_profiles WHERE id=?", order.customerUserId).first<{order_emails: number}>();
    if (profile?.order_emails === 0) return;
  }
  const db = getDb();
  const [existing] = await db.select().from(notifications).where(eq(notifications.dedupeKey, dedupeKey));
  if (existing && existing.status !== "queued" && existing.status !== "failed") return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const settings = commerceEnv();
  const origin = publicSiteUrl(settings.publicSiteUrl);
  const emailOrder: EmailOrder = {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    currency: order.currency,
    merchandiseSubtotalCents: order.merchandiseSubtotalCents,
    discountCents: order.discountCents,
    discountCode: order.discountCode,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    refundedCents: order.refundedCents,
    paymentStatus: order.paymentStatus,
    productionStatus: order.productionStatus,
    shippingStatus: order.shippingStatus,
    carrier: order.carrier,
    serviceName: order.serviceName,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    shipLine1: order.shipLine1,
    shipLine2: order.shipLine2,
    shipCity: order.shipCity,
    shipState: order.shipState,
    shipPostalCode: order.shipPostalCode,
    shipCountry: order.shipCountry,
    orderUrl: `${origin}/account/orders/${encodeURIComponent(order.orderNumber)}`,
    supportUrl: `${origin}/?chat=1`,
    logoUrl: `${origin}/kapo-logo-large.png`,
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
      image: absoluteAsset(item.image, origin),
    })),
  };
  const idempotencyKey = existing?.status === "failed" ? `${dedupeKey}:${existing.updatedAt}` : dedupeKey;
  const result = await deliverEmail({
    apiKey: settings.resendKey,
    from: sender("orders"),
    order: emailOrder,
    template,
    detail,
    idempotencyKey,
  });
  const text = order.smsOptIn ? orderUpdateText(template, order) : null;
  if (text) {
    const textResult = await deliverText({
      apiKey: settings.sendblueKey,
      apiSecret: settings.sendblueSecret,
      from: settings.sendblueFrom,
      to: order.shipPhone,
      content: text,
    });
    logCommerce("order_text", { template, status: textResult.status, error: textResult.error });
  }
  const now = new Date().toISOString();
  if (!existing) {
    try {
      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        template,
        dedupeKey,
        toEmail: order.customerEmail,
        subject: result.subject,
        status: result.status,
        provider: result.provider,
        resendId: result.id,
        error: result.error,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      const message = errorText(error);
      if (!/unique/i.test(message)) throw error;
    }
    return;
  }
  if (existing.status === "queued" || existing.status === "failed") {
    await db.update(notifications).set({
      status: result.status,
      provider: result.provider,
      resendId: result.id,
      subject: result.subject,
      error: result.error,
      updatedAt: now,
    }).where(eq(notifications.id, existing.id));
  }
}

export async function retryFailedEmail(notificationId: string) {
  await ready();
  const db = getDb();
  const [row] = await db.select().from(notifications).where(eq(notifications.id, notificationId));
  if (!row) throw new CommerceError("That email was not found.", 404, "email_missing");
  if (row.status !== "failed" && row.status !== "queued") {
    throw new CommerceError("Only a failed email can be sent again.", 409, "not_retryable");
  }
  const [order] = await db.select().from(orders).where(eq(orders.id, row.orderId));
  if (!order) throw new CommerceError("That order was not found.", 404, "order_missing");
  if (!isEmailTemplate(row.template)) throw new CommerceError("That email template is not available.", 400, "invalid_template");
  await notify(order, row.template, row.dedupeKey);
  const [saved] = await db.select().from(notifications).where(eq(notifications.id, row.id));
  return { status: saved?.status ?? "failed", error: saved?.error ?? null };
}

function absoluteAsset(image: string, origin: string) {
  if (!image) return null;
  if (image.startsWith("https://") || image.startsWith("http://")) return image;
  return `${origin}${image.startsWith("/") ? "" : "/"}${image}`;
}

async function ready() {
  const settings = commerceEnv();
  if (settings.autoMigrate) await ensureCommerceSchema();
  return settings;
}

function stripeClient(key: string) {
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient(), timeout: 15_000, maxNetworkRetries: 1, appInfo: { name: "KAPO", version: "0.1.0" } });
}

function requireShippo(settings: ReturnType<typeof commerceEnv>) {
  if (!settings.shippoToken) throw new CommerceError("Shippo is not configured yet.", 503, "shippo_not_configured");
  const origin = parseOrigin(settings.originJson);
  if (!origin) throw new CommerceError("The shipping origin is not configured.", 503, "origin_not_configured");
  return origin;
}

async function requireOrder(orderId: string) {
  const [order] = await getDb().select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new CommerceError("Order not found.", 404, "order_missing");
  return order;
}

async function labelSafeguardSnapshot() {
  const settings = commerceEnv();
  const limits = resolveLabelLimits(settings.labelMaxCents, settings.labelDailyMaxCents, settings.labelLimitsOverride);
  const day = spendingDay(new Date());
  const [row] = await getDb().select().from(labelSpendDays).where(eq(labelSpendDays.day, day));
  const heldCents = row?.heldCents ?? 0;
  return {
    maxLabelCents: limits.maxLabelCents,
    dailyMaxCents: limits.dailyMaxCents,
    heldCents,
    remainingCents: Math.max(0, limits.dailyMaxCents - heldCents),
    spendingDay: day,
    mode: settings.liveLabelsBlocked ? "live_blocked" as const : labelPurchaseMode(settings.shippoToken, settings.allowLiveLabels),
  };
}

async function reserveLabelSpend(day: string, amountCents: number, limitCents: number) {
  const db = getDb();
  await db.run(sql`INSERT INTO label_spend_days (day, held_cents) VALUES (${day}, 0) ON CONFLICT(day) DO NOTHING`);
  const result = await db.run(sql`UPDATE label_spend_days SET held_cents = held_cents + ${amountCents} WHERE day = ${day} AND held_cents + ${amountCents} <= ${limitCents}`) as { meta?: { changes?: number } };
  return (result.meta?.changes ?? 0) > 0;
}

async function releaseLabelSpend(day: string | null, amountCents: number | null) {
  if (!day || !amountCents || amountCents < 1) return;
  await getDb().run(sql`UPDATE label_spend_days SET held_cents = CASE WHEN held_cents >= ${amountCents} THEN held_cents - ${amountCents} ELSE 0 END WHERE day = ${day}`);
}

async function auditLabel(entry: {
  orderId: string;
  actor: string;
  action: string;
  rateId?: string | null;
  carrier?: string | null;
  serviceName?: string | null;
  amountCents?: number | null;
  testMode: boolean;
  shippoTransactionId?: string | null;
  detail?: string | null;
}) {
  await getDb().insert(labelPurchaseAudit).values({
    id: crypto.randomUUID(),
    orderId: entry.orderId,
    actor: entry.actor,
    action: entry.action,
    rateId: entry.rateId ?? null,
    carrier: entry.carrier ?? null,
    serviceName: entry.serviceName ?? null,
    amountCents: entry.amountCents ?? null,
    testMode: entry.testMode ? 1 : 0,
    shippoTransactionId: entry.shippoTransactionId ?? null,
    detail: entry.detail ?? null,
    createdAt: new Date().toISOString(),
  });
}

async function finishUncertainLabel(
  labelId: string,
  orderId: string,
  actor: string,
  testMode: boolean,
  rateId: string,
  rate: ShippingRate,
  transaction: ShippoTransaction | null,
  detail: string,
) {
  await getDb().update(shippingLabels).set({
    status: "uncertain",
    shippoTransactionId: transaction?.object_id ?? null,
    labelUrl: transaction?.label_url ?? null,
    trackingNumber: transaction?.tracking_number ?? null,
    trackingUrl: transaction?.tracking_url_provider ?? null,
    errorMessage: detail,
    updatedAt: new Date().toISOString(),
  }).where(eq(shippingLabels.id, labelId));
  await auditLabel({
    orderId,
    actor,
    action: "uncertain",
    rateId,
    carrier: rate.provider,
    serviceName: rate.serviceName,
    amountCents: rate.carrierAmountCents,
    testMode,
    shippoTransactionId: transaction?.object_id ?? null,
    detail,
  });
  logCommerce("label_uncertain", { orderId, amountCents: rate.carrierAmountCents });
}

async function markReview(orderId: string, reason: string) {
  const now = new Date().toISOString();
  const updated = await getDb().update(orders).set({ paymentStatus: "review", reviewReason: reason, updatedAt: now }).where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "pending"))).returning();
  if (updated.length) await recordEvent(orderId, "payment", "pending", "review", reason, "stripe");
  logCommerce("order_needs_review", { orderId });
}

async function recordEvent(orderId: string, kind: string, fromStatus: string | null, toStatus: string, note: string, actor: string) {
  await getDb().insert(fulfillmentEvents).values({
    id: crypto.randomUUID(),
    orderId,
    kind,
    fromStatus,
    toStatus,
    note,
    actor,
    createdAt: new Date().toISOString(),
  });
}

function errorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current === "string") {
      parts.push(current);
      break;
    }
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
      continue;
    }
    break;
  }
  return parts.join(" ");
}

async function claimWebhook(provider: string, eventId: string) {
  const now = new Date().toISOString();
  const id = `${provider}:${eventId}`;
  try {
    await getDb().insert(webhookEvents).values({ id, provider, eventId, status: "processing", createdAt: now, updatedAt: now });
    return "claimed" as const;
  } catch (error) {
    const message = errorText(error);
    if (!/unique constraint/i.test(message)) {
      logCommerce("webhook_claim_failed", { provider, detail: message.slice(0, 180) });
      throw error;
    }
    const [existing] = await getDb().select().from(webhookEvents).where(eq(webhookEvents.id, id));
    const ageMs = existing ? Date.now() - Date.parse(existing.updatedAt) : 0;
    const decision = webhookClaimDecision(existing?.status, Number.isFinite(ageMs) ? ageMs : 0);
    if (decision === "in_progress") return "in_progress" as const;
    if (decision !== "claimed") return "duplicate" as const;
    await getDb().update(webhookEvents).set({ status: "processing", updatedAt: now }).where(eq(webhookEvents.id, id));
    return "claimed" as const;
  }
}

async function expireCheckoutSession(stripe: Stripe, sessionId: string) {
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeError)) throw error;
    const again = await stripe.checkout.sessions.retrieve(sessionId);
    if (again.status === "complete" || again.payment_status === "paid") {
      throw new CommerceError("Payment for this order is already submitted. Refresh the confirmation page.", 409, "payment_submitted");
    }
    if (again.status === "open") {
      throw new CommerceError("The previous payment session could not be closed. Wait a moment and try again.", 409, "session_still_open");
    }
  }
}

async function finishWebhook(provider: string, eventId: string, status: "processed" | "failed") {
  await getDb().update(webhookEvents).set({ status, updatedAt: new Date().toISOString() }).where(eq(webhookEvents.id, `${provider}:${eventId}`));
}

function checkoutPayload(order: typeof orders.$inferSelect | typeof orders.$inferInsert, clientSecret: string) {
  return {
    clientSecret,
    orderNumber: order.orderNumber,
    summary: {
      merchandiseSubtotalCents: order.merchandiseSubtotalCents,
      discountCents: order.discountCents,
      discountCode: order.discountCode,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      totalCents: order.totalCents,
      currency: order.currency,
    },
  };
}

function toCustomerOrder(order: typeof orders.$inferSelect, items: typeof orderItems.$inferSelect[]) {
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customerName: order.customerName,
    currency: order.currency,
    merchandiseSubtotalCents: order.merchandiseSubtotalCents,
    discountCents: order.discountCents,
    discountCode: order.discountCode,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    paymentStatus: order.paymentStatus,
    productionStatus: order.productionStatus,
    shippingStatus: order.shippingStatus,
    carrier: order.carrier,
    serviceName: order.serviceName,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    carrierTransitDays: order.carrierTransitDays,
    durationTerms: order.durationTerms,
    productionDaysMin: order.productionDaysMin,
    productionDaysMax: order.productionDaysMax,
    address: { city: order.shipCity, state: order.shipState, postalCode: order.shipPostalCode, country: order.shipCountry },
    items: items.map((item) => ({ name: item.name, style: item.style, image: item.image, quantity: item.quantity, lineTotalCents: item.lineTotalCents })),
  };
}

function toAdminListItem(order: typeof orders.$inferSelect) {
  return order;
}

function orderAddress(order: typeof orders.$inferSelect): ShippingAddress {
  return {
    name: order.shipName,
    email: order.customerEmail,
    phone: order.shipPhone,
    line1: order.shipLine1,
    line2: order.shipLine2,
    city: order.shipCity,
    state: order.shipState,
    postalCode: order.shipPostalCode,
    country: order.shipCountry,
  };
}

function publicRate(rate: ShippingRate) {
  return {
    id: rate.id,
    provider: rate.provider,
    serviceName: rate.serviceName,
    tierLabel: rate.tierLabel ?? null,
    detail: rate.detail ?? null,
    amountCents: rate.amountCents,
    carrierAmountCents: rate.carrierAmountCents,
    estimatedDays: rate.estimatedDays,
    durationTerms: rate.durationTerms,
  };
}

function stripeAddress(address: ShippingAddress) {
  return {
    line1: address.line1,
    line2: address.line2 || undefined,
    city: address.city,
    state: address.state,
    postal_code: address.postalCode,
    country: "US" as const,
  };
}

function intentId(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function createOrderNumber() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `KAPO-${[...bytes].map((byte) => alphabet[byte % alphabet.length]).join("")}`;
}
