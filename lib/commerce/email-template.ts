import { formatCents } from "./money.ts";
import type { EmailTemplate } from "./status.ts";

export type EmailOrder = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  currency: string;
  merchandiseSubtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  refundedCents: number;
  paymentStatus: string;
  productionStatus: string;
  shippingStatus: string;
  carrier: string | null;
  serviceName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shipCity: string;
  shipState: string;
  items: { name: string; quantity: number; lineTotalCents: number }[];
};

export function renderEmail(template: EmailTemplate, order: EmailOrder, detail = "") {
  const subject = subjectFor(template, order.orderNumber);
  const intro = introFor(template, order, detail);
  const rows = order.items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${formatCents(item.lineTotalCents, order.currency)}</td></tr>`).join("");
  const tracking = order.trackingNumber
    ? `<p>Tracking: ${order.trackingUrl ? `<a href="${escapeHtml(order.trackingUrl)}">${escapeHtml(order.trackingNumber)}</a>` : escapeHtml(order.trackingNumber)}</p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f7f7f7;color:#101113;font-family:Inter,Helvetica,Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e5e5e5"><tr><td style="padding:28px"><p style="margin:0 0 8px;font-size:12px;letter-spacing:.14em;font-weight:700">KAPO</p><h1 style="margin:0 0 12px;font-size:28px;letter-spacing:-.04em">${escapeHtml(subject)}</h1><p style="margin:0 0 18px;line-height:1.5">${escapeHtml(intro)}</p><p style="margin:0 0 18px"><strong>Order ${escapeHtml(order.orderNumber)}</strong></p><table width="100%" cellpadding="8" style="border-collapse:collapse;font-size:14px"><tr><th align="left">Item</th><th align="left">Qty</th><th align="left">Total</th></tr>${rows}</table><p style="margin:18px 0 0;font-size:14px;line-height:1.6">Subtotal ${formatCents(order.merchandiseSubtotalCents, order.currency)}<br>Discount ${formatCents(order.discountCents, order.currency)}${order.discountCode ? ` (${escapeHtml(order.discountCode)})` : ""}<br>Shipping ${formatCents(order.shippingCents, order.currency)}<br>Tax ${formatCents(order.taxCents, order.currency)}<br><strong>Total ${formatCents(order.totalCents, order.currency)}</strong></p>${tracking}<p style="margin:18px 0 0;color:#686d75;font-size:12px;line-height:1.5">Production and carrier transit are separate. Shipping is paid by the customer. KAPO prints each order in small batches.</p></td></tr></table></td></tr></table></body></html>`;
  const text = [
    subject,
    intro,
    `Order ${order.orderNumber}`,
    ...order.items.map((item) => `${item.quantity} × ${item.name} — ${formatCents(item.lineTotalCents, order.currency)}`),
    `Subtotal ${formatCents(order.merchandiseSubtotalCents, order.currency)}`,
    `Discount ${formatCents(order.discountCents, order.currency)}`,
    `Shipping ${formatCents(order.shippingCents, order.currency)}`,
    `Tax ${formatCents(order.taxCents, order.currency)}`,
    `Total ${formatCents(order.totalCents, order.currency)}`,
    order.trackingNumber ? `Tracking ${order.trackingNumber}${order.trackingUrl ? ` ${order.trackingUrl}` : ""}` : "",
  ].filter(Boolean).join("\n");
  return { subject, html, text };
}

function subjectFor(template: EmailTemplate, orderNumber: string) {
  const subjects: Record<EmailTemplate, string> = {
    payment_confirmation: `Payment received for ${orderNumber}`,
    order_confirmation: `KAPO order ${orderNumber}`,
    production_started: `${orderNumber} is in production`,
    order_ready_to_ship: `${orderNumber} is ready to ship`,
    shipment_confirmation: `${orderNumber} is on the way`,
    tracking_update: `Tracking update for ${orderNumber}`,
    delivery_confirmation: `${orderNumber} was delivered`,
    refund_confirmation: `Refund for ${orderNumber}`,
  };
  return subjects[template];
}

function introFor(template: EmailTemplate, order: EmailOrder, detail: string) {
  switch (template) {
    case "payment_confirmation":
      return `Thanks, ${order.customerName}. Stripe confirmed your payment. KAPO will not treat the order as paid until this confirmation is recorded.`;
    case "order_confirmation":
      return `Your KAPO order is confirmed and waiting to be produced. Production time is separate from the carrier’s transit time.`;
    case "production_started":
      return "Printing has started on your order.";
    case "order_ready_to_ship":
      return "Your order passed packing and is ready for a shipping label.";
    case "shipment_confirmation":
      return `Your order has been handed to ${order.carrier ?? "the carrier"}${order.serviceName ? ` via ${order.serviceName}` : ""}.`;
    case "tracking_update":
      return detail || "The carrier posted a tracking update.";
    case "delivery_confirmation":
      return "The carrier marked this shipment delivered.";
    case "refund_confirmation":
      return `A refund of ${formatCents(order.refundedCents, order.currency)} was recorded for this order.`;
    default:
      return "There is an update on your KAPO order.";
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
