import { addressesMatch } from "./address.ts";
import { publicSiteUrl } from "../email/addresses.ts";

export type SessionSnapshot = {
  paymentStatus: string;
  amountSubtotal: number | null;
  amountTotal: number | null;
  amountShipping: number | null;
  amountDiscount: number | null;
  amountTax: number | null;
  shipping: { line1: string; city: string; state: string; postalCode: string; country: string } | null;
};

export type QuotedOrder = {
  merchandiseSubtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shipLine1: string;
  shipCity: string;
  shipState: string;
  shipPostalCode: string;
  shipCountry: string;
};

export function assessPaidSession(order: QuotedOrder, session: SessionSnapshot) {
  if (session.paymentStatus !== "paid") return { action: "ignore" as const };
  const taxCents = session.amountTax ?? 0;
  const totalCents = session.amountTotal ?? order.totalCents;
  const expectedTotal = quotedChargeCents({ ...order, taxCents });
  const totalsMatch = session.amountSubtotal === order.merchandiseSubtotalCents
    && (session.amountDiscount ?? 0) === order.discountCents
    && session.amountShipping === order.shippingCents
    && session.amountTotal === expectedTotal
    && session.amountTotal === order.totalCents;
  const addressMatches = !session.shipping || addressesMatch(session.shipping, {
    line1: order.shipLine1,
    city: order.shipCity,
    state: order.shipState,
    postalCode: order.shipPostalCode,
    country: order.shipCountry,
  });
  if (!totalsMatch) {
    return { action: "review" as const, taxCents, totalCents, reason: "Charged totals did not match the quoted order." };
  }
  if (!addressMatches) {
    return { action: "review" as const, taxCents, totalCents, reason: "The paid shipping address does not match the quoted address." };
  }
  return { action: "pay" as const, taxCents, totalCents };
}

export function quotedChargeCents(order: Pick<QuotedOrder, "merchandiseSubtotalCents" | "discountCents" | "shippingCents" | "taxCents">) {
  return order.merchandiseSubtotalCents - order.discountCents + order.shippingCents + order.taxCents;
}

export function planCheckoutContinuation(input: {
  status: string | null;
  paymentStatus: string | null;
  hasClientSecret: boolean;
  sameTerms: boolean;
}) {
  if (input.paymentStatus === "paid" || input.paymentStatus === "no_payment_required" || input.status === "complete") {
    return { action: "wait" as const };
  }
  if (input.status === "open" && input.hasClientSecret && input.sameTerms) {
    return { action: "reuse" as const };
  }
  return { action: "replace" as const, expire: input.status === "open" };
}

export function checkoutSessionIdempotencyKey(orderId: string, rateId: string, discountCents: number, previousSessionId: string | null) {
  return `kapo-session-v3-${orderId}-${rateId}-${discountCents}-${previousSessionId ?? "initial"}`;
}

export function checkoutReturnOrigin(requestOrigin: string, publicSite: string, nodeEnv = process.env.NODE_ENV) {
  const site = publicSiteUrl(publicSite);
  if (nodeEnv !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin)) {
    return requestOrigin;
  }
  return site;
}
