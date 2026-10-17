import { addressesMatch } from "./address.ts";

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
  const expectedTotal = order.merchandiseSubtotalCents - order.discountCents + order.shippingCents + taxCents;
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
