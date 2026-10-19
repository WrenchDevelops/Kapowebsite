export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "partially_refunded", "review"] as const;
export const PRODUCTION_STATUSES = ["pending_payment", "awaiting_production", "printing", "quality_control", "packaging", "ready_to_ship", "shipped", "delivered"] as const;
export const SHIPPING_STATUSES = ["not_purchased", "quoted", "label_purchased", "shipped", "in_transit", "delivered", "void_requested", "voided", "error"] as const;
export const ADMIN_PRODUCTION_STATUSES = ["awaiting_production", "printing", "quality_control", "packaging", "ready_to_ship"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];
export type ShippingStatus = (typeof SHIPPING_STATUSES)[number];
export const EMAIL_TEMPLATES = [
  "payment_confirmation",
  "order_confirmation",
  "production_started",
  "order_ready_to_ship",
  "shipment_confirmation",
  "out_for_delivery",
  "tracking_update",
  "delivery_exception",
  "returned_shipment",
  "delivery_confirmation",
  "refund_confirmation",
  "payment_failed",
  "order_canceled",
] as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

const EMAIL_TEMPLATE_SET = new Set<string>(EMAIL_TEMPLATES);

export function isEmailTemplate(value: string): value is EmailTemplate {
  return EMAIL_TEMPLATE_SET.has(value);
}

export const PRODUCTION_LABELS: Record<ProductionStatus, string> = {
  pending_payment: "Awaiting payment",
  awaiting_production: "Paid / Awaiting Production",
  printing: "Printing",
  quality_control: "Quality Control",
  packaging: "Packaging",
  ready_to_ship: "Ready to Ship",
  shipped: "Shipped",
  delivered: "Delivered",
};

export function isAdminProductionStatus(value: string): value is (typeof ADMIN_PRODUCTION_STATUSES)[number] {
  return (ADMIN_PRODUCTION_STATUSES as readonly string[]).includes(value);
}

export function productionEmail(next: ProductionStatus): EmailTemplate | null {
  if (next === "printing") return "production_started";
  if (next === "ready_to_ship") return "order_ready_to_ship";
  return null;
}

export type TrackingUpdate = {
  shippingStatus: ShippingStatus;
  productionStatus: ProductionStatus | null;
  emails: EmailTemplate[];
};

export function applyTrackingStatus(currentShipping: ShippingStatus, currentProduction: ProductionStatus, trackingStatus: string, substatus = ""): TrackingUpdate {
  const status = trackingStatus.toUpperCase();
  const detail = substatus.toLowerCase().replace(/[\s-]+/g, "_");
  if (status === "DELIVERED") {
    return { shippingStatus: "delivered", productionStatus: "delivered", emails: ["delivery_confirmation"] };
  }
  if (currentShipping === "delivered" && (status === "TRANSIT" || detail === "out_for_delivery")) return { shippingStatus: "delivered", productionStatus: "delivered", emails: [] };
  if (detail === "out_for_delivery") {
    return {
      shippingStatus: "in_transit",
      productionStatus: currentProduction === "delivered" ? "delivered" : "shipped",
      emails: ["out_for_delivery"],
    };
  }
  if (status === "TRANSIT") {
    const alreadyMoving = currentShipping === "shipped" || currentShipping === "in_transit" || currentShipping === "delivered";
    return {
      shippingStatus: "in_transit",
      productionStatus: currentProduction === "delivered" ? "delivered" : "shipped",
      emails: alreadyMoving ? ["tracking_update"] : ["shipment_confirmation"],
    };
  }
  if (status === "PRE_TRANSIT") {
    return { shippingStatus: currentShipping === "not_purchased" ? "label_purchased" : currentShipping, productionStatus: null, emails: [] };
  }
  if (status === "RETURNED") {
    return { shippingStatus: "error", productionStatus: null, emails: ["returned_shipment"] };
  }
  if (status === "FAILURE") {
    return { shippingStatus: "error", productionStatus: null, emails: ["delivery_exception"] };
  }
  return { shippingStatus: currentShipping, productionStatus: null, emails: [] };
}

export type LabelAttempt = { status: string; createdAt: string };

const OPEN_LABEL_RANK: Record<string, number> = { succeeded: 0, void_requested: 1, uncertain: 2, pending: 3 };

export function planLabelPurchase(labels: LabelAttempt[], now: Date) {
  const blocking = labels
    .filter((label) => OPEN_LABEL_RANK[label.status] !== undefined)
    .sort((left, right) => OPEN_LABEL_RANK[left.status] - OPEN_LABEL_RANK[right.status])[0];
  if (!blocking) return { ok: true as const };
  if (blocking.status === "succeeded") return { ok: false as const, message: "This order already has a shipping label." };
  if (blocking.status === "void_requested") {
    return { ok: false as const, message: "A label refund is still pending. KAPO will not buy another label until Shippo finishes the void." };
  }
  if (blocking.status === "uncertain") {
    return { ok: false as const, message: "A previous purchase did not return a definite result. Check Shippo before trying again. KAPO will not buy another label until you clear that attempt." };
  }
  const ageMs = now.getTime() - Date.parse(blocking.createdAt);
  if (ageMs < 2 * 60 * 1000) return { ok: false as const, message: "A label purchase is already in progress." };
  return { ok: false as const, message: "A previous label attempt did not finish. Confirm in Shippo that no label was purchased, then clear the attempt." };
}

export function labelPurchaseResult(success: boolean) {
  if (!success) {
    return { shippingStatus: "not_purchased" as const, productionStatus: null, shipped: false };
  }
  return { shippingStatus: "label_purchased" as const, productionStatus: null, shipped: false };
}

export function canMarkShipped(order: { paymentStatus: string; shippingStatus: string; trackingNumber: string | null }) {
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") {
    return { ok: false as const, message: "Only a paid order can be marked shipped." };
  }
  if (order.shippingStatus !== "label_purchased" || !order.trackingNumber) {
    return { ok: false as const, message: "Purchase a label before marking the parcel handed to the carrier." };
  }
  return { ok: true as const };
}

export function isUnfulfilled(order: { paymentStatus: string; productionStatus: string }) {
  const paid = order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded";
  return paid && order.productionStatus !== "shipped" && order.productionStatus !== "delivered";
}

export function isAwaitingShipment(order: { productionStatus: string; shippingStatus: string }) {
  return order.productionStatus === "ready_to_ship" && !["shipped", "in_transit", "delivered"].includes(order.shippingStatus);
}

export type FinanceOrder = {
  paymentStatus: string;
  totalCents: number;
  refundedCents: number;
  taxCents: number;
  shippingCents: number;
};

export function paymentSuccessEmails(): EmailTemplate[] {
  return ["order_confirmation"];
}

export function refundPaymentStatus(totalCents: number, refundedCents: number, current: string) {
  if (refundedCents >= totalCents && totalCents > 0) return "refunded";
  if (refundedCents > 0) return "partially_refunded";
  return current;
}

export function applyRefundSnapshot(order: { paymentStatus: string; refundedCents: number; totalCents: number }, refundedCents: number) {
  if (order.paymentStatus === "pending" || order.paymentStatus === "failed") {
    return { action: "retry" as const };
  }
  if (!Number.isInteger(refundedCents) || refundedCents < order.refundedCents) {
    return { action: "ignore" as const };
  }
  return {
    action: "apply" as const,
    refundedCents,
    status: refundPaymentStatus(order.totalCents, refundedCents, order.paymentStatus),
  };
}

export function summarizeFinance(orders: FinanceOrder[], labelCostCents: number) {
  const collected = orders.filter((order) => ["paid", "partially_refunded", "refunded"].includes(order.paymentStatus));
  const grossSalesCents = collected.reduce((total, order) => total + order.totalCents, 0);
  const refundsCents = collected.reduce((total, order) => total + order.refundedCents, 0);
  const netRevenueCents = grossSalesCents - refundsCents;
  const taxCollectedCents = collected.reduce((total, order) => total + order.taxCents, 0);
  const shippingChargedCents = collected.reduce((total, order) => total + order.shippingCents, 0);
  return {
    orderCount: orders.length,
    paidCount: collected.length,
    grossSalesCents,
    refundsCents,
    netRevenueCents,
    taxCollectedCents,
    shippingChargedCents,
    labelCostCents,
    profitCents: netRevenueCents - taxCollectedCents - labelCostCents,
  };
}

export function financeCounts(orders: { paymentStatus: string; productionStatus: string; shippingStatus: string }[]) {
  return {
    unfulfilledCount: orders.filter(isUnfulfilled).length,
    awaitingShipmentCount: orders.filter(isAwaitingShipment).length,
  };
}
