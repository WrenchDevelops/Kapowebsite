import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import Stripe from "stripe";
import { getDb } from "../../db/index.ts";
import { ensureCommerceSchema } from "../../db/migrate.ts";
import {
  fulfillmentEvents,
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
import { assessPaidSession, type SessionSnapshot } from "./checkout-session.ts";
import { applyDiscount, parseDiscountCodes } from "./discounts.ts";
import { deliverEmail } from "./email.ts";
import { deliverText, orderUpdateText } from "./sendblue.ts";
import type { EmailOrder } from "./email-template.ts";
import { commerceEnv, logCommerce, readEnv } from "./env.ts";
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
  labelPurchaseResult,
  planLabelPurchase,
  productionEmail,
  refundPaymentStatus,
  summarizeFinance,
  type EmailTemplate,
} from "./status.ts";

type Viewer = { userId: string; email: string } | null;

export async function createShippingQuote(input: {
  items: { productId?: string; quantity?: number }[];
  address: ShippingAddress;
  user: Viewer;
  ip: string;
  now?: Date;
}) {
  const settings = await ready();
  if (!settings.shippoToken) throw new CommerceError("Shippo is not configured yet. Add SHIPPO_API_TOKEN.", 503, "shippo_not_configured");
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

export async function createCheckout(input: { quoteId: string; rateId: string; discountCode?: string; origin: string; now?: Date }) {
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
  const discount = applyDiscount(quote.merchandiseSubtotalCents, input.discountCode, parseDiscountCodes(settings.discountCodes));
  if (!discount.ok) throw new CommerceError(discount.message, 400, "invalid_discount");

  const [existing] = await db.select().from(orders).where(eq(orders.quoteId, quote.id));
  if (existing?.stripeCheckoutSessionId && existing.paymentStatus === "pending") {
    const stripe = stripeClient(settings.stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(existing.stripeCheckoutSessionId);
    if (session.status === "open" && session.client_secret) {
      return checkoutPayload(existing, session.client_secret);
    }
  }
  if (existing && existing.paymentStatus !== "pending") {
    throw new CommerceError("This quote has already been used.", 409, "quote_used");
  }

  const orderId = existing?.id ?? crypto.randomUUID();
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
    await db.insert(orders).values(orderValues);
    await db.insert(orderItems).values(lines.map((line) => ({
      id: crypto.randomUUID(),
      orderId,
      productId: line.productId,
      name: line.name,
      style: line.style,
      image: line.image,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: line.lineTotalCents,
    })));
    await db.insert(payments).values({
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
    });
    await db.insert(shipments).values({
      id: crypto.randomUUID(),
      orderId,
      shippoShipmentId: quote.shippoShipmentId,
      parcelJson: quote.parcelJson,
      ratesJson: quote.ratesJson,
      refreshedAt: null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  const stripe = stripeClient(settings.stripeSecretKey);
  const session = await openCheckoutSession({ stripe, settings, orderId, orderNumber, quoteId: quote.id, lines, address, rate, discount, origin: input.origin });
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
    }, { idempotencyKey: `kapo-session-v2-${input.orderId}-${input.rate.id}-${input.discount.discountCents}` });
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
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await settleCheckoutSession(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.async_payment_failed") {
      await failCheckoutSession(event.data.object as Stripe.Checkout.Session);
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

async function settleCheckoutSession(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return;
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
  if (!updated.length) return;
  await db.update(payments).set({ status: "paid", stripePaymentIntentId: paymentIntent, amountCents: decision.totalCents, updatedAt: now }).where(eq(payments.orderId, order.id));
  await recordEvent(order.id, "payment", "pending", "paid", "Stripe webhook", "stripe");
  await recordEvent(order.id, "production", order.productionStatus, "awaiting_production", "Payment confirmed", "stripe");
  const saved = updated[0];
  await notify(saved, "payment_confirmation", `payment_confirmation:${order.id}`);
  await notify(saved, "order_confirmation", `order_confirmation:${order.id}`);
  logCommerce("order_paid", { orderId: order.id });
}

function sessionShipping(session: Stripe.Checkout.Session): SessionSnapshot["shipping"] {
  const address = session.collected_information?.shipping_details?.address;
  if (!address?.line1 || !address.city || !address.state || !address.postal_code || !address.country) return null;
  return { line1: address.line1, city: address.city, state: address.state, postalCode: address.postal_code, country: address.country };
}

async function failCheckoutSession(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;
  const now = new Date().toISOString();
  const updated = await getDb().update(orders).set({ paymentStatus: "failed", updatedAt: now }).where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "pending"))).returning();
  if (updated.length) await getDb().update(payments).set({ status: "failed", updatedAt: now }).where(eq(payments.orderId, orderId));
}

async function applyRefund(charge: Stripe.Charge, stripeKey: string) {
  const paymentIntent = intentId(charge.payment_intent);
  if (!paymentIntent) return;
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.stripePaymentIntentId, paymentIntent));
  if (!order) return;
  const refundedCents = charge.amount_refunded ?? 0;
  const status = refundPaymentStatus(order.totalCents, refundedCents, order.paymentStatus);
  const now = new Date().toISOString();
  await db.update(orders).set({ refundedCents, paymentStatus: status, updatedAt: now }).where(eq(orders.id, order.id));
  await db.update(payments).set({ refundedCents, status, stripeChargeId: charge.id, updatedAt: now }).where(eq(payments.orderId, order.id));
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
  const status = String((data.tracking_status as { status?: string } | undefined)?.status ?? data.tracking_status ?? "");
  const occurredAt = String((data.tracking_status as { status_date?: string } | undefined)?.status_date ?? new Date().toISOString());
  const transactionId = String(data.object_id ?? data.transaction ?? trackingNumber);
  const eventId = await hashValue(`${eventName}:${transactionId}:${trackingNumber}:${status}:${occurredAt}`);
  const claim = await claimWebhook("shippo", eventId);
  if (claim === "duplicate") return { duplicate: true };
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
  const tracking = (data.tracking_status ?? {}) as { status?: string; status_details?: string; status_date?: string; object_id?: string };
  const status = tracking.status ?? "UNKNOWN";
  const occurredAt = tracking.status_date ?? new Date().toISOString();
  const dedupeKey = await hashValue(`${order.id}:${trackingNumber}:${status}:${occurredAt}`);
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
    const message = error instanceof Error ? error.message : "";
    if (/unique/i.test(message)) return;
    throw error;
  }
  const next = applyTrackingStatus(order.shippingStatus as "quoted", order.productionStatus as "pending_payment", status);
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
  if (existingShipment) {
    await db.update(shipments).set({ shippoShipmentId: shipment.object_id, parcelJson: JSON.stringify(parcelResult.parcel), ratesJson: JSON.stringify(rates), refreshedAt: now, updatedAt: now }).where(eq(shipments.orderId, orderId));
  }
  return { rates: rates.map(publicRate), parcel: parcelResult.parcel, refreshedAt: now };
}

export async function purchaseLabel(orderId: string, rateId: string, actor: string, confirmed: boolean) {
  const settings = await ready();
  if (!confirmed) throw new CommerceError("Confirm the label purchase before KAPO buys postage.", 400, "confirmation_required");
  const liveBlock = liveModeBlocked(settings.shippoToken, "shippo", settings.allowLiveLabels);
  if (liveBlock) throw new CommerceError(liveBlock, 503, "live_labels_blocked");
  requireShippo(settings);
  const order = await requireOrder(orderId);
  const db = getDb();
  const [shipment] = await db.select().from(shipments).where(eq(shipments.orderId, orderId));
  const rates = JSON.parse(shipment?.ratesJson || "[]") as ShippingRate[];
  const rate = findRate(rates, rateId);
  if (!shipment?.refreshedAt || !rate) throw new CommerceError("Refresh carrier rates for the final parcel, then choose a service.", 409, "rates_not_refreshed");
  if (Date.now() - Date.parse(shipment.refreshedAt) > 24 * 60 * 60 * 1000) {
    throw new CommerceError("Those carrier rates expired. Refresh them before buying a label.", 409, "rates_expired");
  }
  const existingLabels = await db.select().from(shippingLabels).where(eq(shippingLabels.orderId, orderId));
  const plan = planLabelPurchase(existingLabels, new Date());
  if (!plan.ok) throw new CommerceError(plan.message, 409, "label_blocked");
  const labelId = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.insert(shippingLabels).values({
      id: labelId,
      orderId,
      shipmentId: shipment.id,
      shippoTransactionId: null,
      shippoRateId: rate.id,
      status: "pending",
      carrier: rate.provider,
      serviceName: rate.serviceName,
      amountCents: rate.carrierAmountCents,
      labelUrl: null,
      trackingNumber: null,
      trackingUrl: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique/i.test(message)) throw new CommerceError("A label purchase is already active for this order.", 409, "label_blocked");
    throw error;
  }
  let transaction: ShippoTransaction;
  try {
    transaction = await new ShippoClient(settings.shippoToken).purchaseLabel(rate.id, order.orderNumber);
  } catch (error) {
    await db.update(shippingLabels).set({ status: "failed", errorMessage: "Shippo request failed", updatedAt: new Date().toISOString() }).where(eq(shippingLabels.id, labelId));
    if (error instanceof CommerceError) throw error;
    throw new CommerceError("The label purchase failed. The order was not marked shipped.", 502, "label_failed");
  }
  const success = transaction.status === "SUCCESS" && Boolean(transaction.tracking_number);
  const result = labelPurchaseResult(success);
  const finished = new Date().toISOString();
  await db.update(shippingLabels).set({
    status: success ? "succeeded" : "failed",
    shippoTransactionId: transaction.object_id ?? null,
    labelUrl: transaction.label_url ?? null,
    trackingNumber: transaction.tracking_number ?? null,
    trackingUrl: transaction.tracking_url_provider ?? null,
    errorMessage: success ? null : transaction.messages?.map((message) => message.text).filter(Boolean).join(" ") || "Label purchase failed",
    updatedAt: finished,
  }).where(eq(shippingLabels.id, labelId));
  if (!success) throw new CommerceError("Shippo did not return a label. The order was not marked shipped.", 502, "label_failed");
  await db.update(orders).set({
    shippingStatus: result.shippingStatus,
    carrier: rate.provider,
    serviceName: rate.serviceName,
    serviceToken: rate.serviceToken,
    shippoRateId: rate.id,
    shippoShipmentId: shipment.shippoShipmentId,
    trackingNumber: transaction.tracking_number ?? null,
    trackingUrl: transaction.tracking_url_provider ?? null,
    updatedAt: finished,
  }).where(eq(orders.id, orderId));
  await recordEvent(orderId, "shipping", order.shippingStatus, result.shippingStatus, "Label purchased", actor);
  logCommerce("label_purchased", { orderId, shipped: result.shipped });
  return getAdminOrder(orderId);
}

export async function clearLabelAttempt(orderId: string, confirmed: boolean) {
  await ready();
  if (!confirmed) throw new CommerceError("Confirm that Shippo did not sell a label before clearing the attempt.", 400, "confirmation_required");
  const now = new Date().toISOString();
  await getDb().update(shippingLabels).set({ status: "failed", errorMessage: "Cleared by admin after Shippo check", updatedAt: now }).where(and(eq(shippingLabels.orderId, orderId), eq(shippingLabels.status, "pending")));
  return getAdminOrder(orderId);
}

export async function markShipped(orderId: string, actor: string) {
  await ready();
  const order = await requireOrder(orderId);
  const decision = canMarkShipped(order);
  if (!decision.ok) throw new CommerceError(decision.message, 409, "cannot_ship");
  const now = new Date().toISOString();
  await getDb().update(orders).set({ shippingStatus: "shipped", productionStatus: "shipped", updatedAt: now }).where(eq(orders.id, orderId));
  await recordEvent(orderId, "shipping", order.shippingStatus, "shipped", "Handed to carrier", actor);
  await recordEvent(orderId, "production", order.productionStatus, "shipped", "Handed to carrier", actor);
  await notify({ ...order, shippingStatus: "shipped", productionStatus: "shipped" }, "shipment_confirmation", `shipment_confirmation:${orderId}`);
  return getAdminOrder(orderId);
}

export async function voidLabel(orderId: string, actor: string) {
  const settings = await ready();
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
  await db.update(shippingLabels).set({ status, updatedAt: now }).where(eq(shippingLabels.id, label.id));
  await db.update(orders).set({ shippingStatus: status, updatedAt: now }).where(eq(orders.id, orderId));
  await recordEvent(orderId, "shipping", order.shippingStatus, status, "Label void requested", actor);
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
  const rows = await getDb().select().from(orders).where(or(eq(orders.customerUserId, user.userId), eq(orders.customerEmail, user.email.toLowerCase()))).orderBy(desc(orders.createdAt));
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
  const [items, labels, events, tracking, shipment] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(shippingLabels).where(eq(shippingLabels.orderId, orderId)).orderBy(desc(shippingLabels.createdAt)),
    db.select().from(fulfillmentEvents).where(eq(fulfillmentEvents.orderId, orderId)).orderBy(desc(fulfillmentEvents.createdAt)),
    db.select().from(trackingEvents).where(eq(trackingEvents.orderId, orderId)).orderBy(desc(trackingEvents.occurredAt)),
    db.select().from(shipments).where(eq(shipments.orderId, orderId)),
  ]);
  return {
    ...toAdminListItem(order),
    items,
    labels,
    events,
    tracking,
    shipment: shipment[0] ? { ...shipment[0], rates: JSON.parse(shipment[0].ratesJson) as ShippingRate[], parcel: JSON.parse(shipment[0].parcelJson) as Parcel } : null,
    parcel: JSON.parse(order.parcelJson) as Parcel,
  };
}

async function notify(order: typeof orders.$inferSelect, template: EmailTemplate, dedupeKey: string, detail?: string) {
  const db = getDb();
  const [existing] = await db.select().from(notifications).where(eq(notifications.dedupeKey, dedupeKey));
  if (existing?.status === "sent") return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const settings = commerceEnv();
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
    shipCity: order.shipCity,
    shipState: order.shipState,
    items: items.map((item) => ({ name: item.name, quantity: item.quantity, lineTotalCents: item.lineTotalCents })),
  };
  const result = await deliverEmail({ apiKey: settings.resendKey, from: settings.emailFrom, order: emailOrder, template, detail });
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
        error: result.error,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/unique/i.test(message)) throw error;
    }
    return;
  }
  if (existing.status === "queued" || existing.status === "failed") {
    await db.update(notifications).set({ status: result.status, provider: result.provider, error: result.error, updatedAt: now }).where(eq(notifications.id, existing.id));
  }
}

async function ready() {
  const settings = commerceEnv();
  if (settings.autoMigrate) await ensureCommerceSchema();
  return settings;
}

function stripeClient(key: string) {
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient(), appInfo: { name: "KAPO", version: "0.1.0" } });
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

async function claimWebhook(provider: string, eventId: string) {
  const now = new Date().toISOString();
  const id = `${provider}:${eventId}`;
  try {
    await getDb().insert(webhookEvents).values({ id, provider, eventId, status: "processing", createdAt: now, updatedAt: now });
    return "claimed" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/unique/i.test(message)) throw error;
    const [existing] = await getDb().select().from(webhookEvents).where(eq(webhookEvents.id, id));
    if (existing?.status === "failed") {
      await getDb().update(webhookEvents).set({ status: "processing", updatedAt: now }).where(eq(webhookEvents.id, id));
      return "claimed" as const;
    }
    return "duplicate" as const;
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
