import type { CharacterSlug } from "../catalog.ts";
import {
  brandedEmailHtml,
  emailButton,
  emailFacts,
  emailLink,
  emailNote,
  emailOrigin,
  escapeHtml,
  footerBlock,
  safeHttpUrl,
} from "../email/design.ts";
import { productionWindow, socialPlainText, SUPPORT_EMAIL } from "../store-facts.ts";
import { formatCents } from "./money.ts";
import type { EmailTemplate } from "./status.ts";

export type EmailLine = {
  name: string;
  quantity: number;
  lineTotalCents: number;
  image?: string | null;
};

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
  shipLine1?: string;
  shipLine2?: string;
  shipCity: string;
  shipState: string;
  shipPostalCode?: string;
  shipCountry?: string;
  orderUrl?: string;
  supportUrl?: string;
  logoUrl?: string;
  expectedDelivery?: string | null;
  items: EmailLine[];
};

const FONT = "Arial, Helvetica, sans-serif";

type Cast = { character: CharacterSlug | null; mode: "hero" | "compact" | "none" };

const CAST: Record<EmailTemplate, Cast> = {
  payment_confirmation: { character: "spore", mode: "compact" },
  order_confirmation: { character: "spore", mode: "hero" },
  production_started: { character: "gloop", mode: "hero" },
  order_ready_to_ship: { character: "gloop", mode: "compact" },
  shipment_confirmation: { character: "orbit", mode: "hero" },
  out_for_delivery: { character: "brine", mode: "hero" },
  tracking_update: { character: null, mode: "none" },
  delivery_exception: { character: null, mode: "none" },
  returned_shipment: { character: null, mode: "none" },
  delivery_confirmation: { character: "rango", mode: "hero" },
  refund_confirmation: { character: null, mode: "none" },
  payment_failed: { character: null, mode: "none" },
  order_canceled: { character: null, mode: "none" },
};

export function renderEmail(template: EmailTemplate, order: EmailOrder, detail = "") {
  const origin = emailOrigin(order.logoUrl || order.orderUrl);
  const subject = subjectFor(template, order.orderNumber);
  const headline = headingFor(template);
  const paragraphs = introFor(template, order, detail);
  const cast = CAST[template];
  const actions = actionsFor(template, order);
  const bodyHtml = bodyFor(template, order, origin);
  const contactUrl = order.supportUrl ? safeHttpUrl(order.supportUrl) : "";
  const footer = [
    "KAPO prints each order in small batches. Production time is separate from carrier transit.",
    `Questions: <a href="mailto:${SUPPORT_EMAIL}" style="color:#111111;">${SUPPORT_EMAIL}</a>`,
    contactUrl ? `<a href="${escapeHtml(contactUrl)}" style="color:#111111;">Contact KAPO</a>` : "",
    "This message is about your order and is not a newsletter.",
  ].filter(Boolean);
  const html = brandedEmailHtml({
    origin,
    preheader: paragraphs[0] ?? headline,
    eyebrow: `Order ${order.orderNumber}`,
    headline,
    paragraphs,
    character: cast.character,
    characterMode: cast.mode,
    actionsHtml: actions.html,
    bodyHtml,
    footerHtml: footerBlock(footer),
  });
  const text = [
    subject,
    "",
    headline,
    "",
    ...paragraphs,
    ...actions.text,
    "",
    `Order ${order.orderNumber}`,
    ...order.items.map((item) => `${item.quantity} × ${item.name} — ${formatCents(item.lineTotalCents, order.currency)}`),
    `Subtotal ${formatCents(order.merchandiseSubtotalCents, order.currency)}`,
    `Discount ${formatCents(order.discountCents, order.currency)}${order.discountCode ? ` (${order.discountCode})` : ""}`,
    `Shipping ${formatCents(order.shippingCents, order.currency)}`,
    `Tax ${formatCents(order.taxCents, order.currency)}`,
    `Total ${formatCents(order.totalCents, order.currency)}`,
    template === "refund_confirmation" ? `Refunded ${formatCents(order.refundedCents, order.currency)}` : "",
    order.trackingNumber ? `Tracking number: ${order.trackingNumber}` : "",
    order.trackingUrl ? `Track shipment: ${order.trackingUrl}` : "",
    order.carrier ? `Carrier: ${order.carrier}` : "",
    template === "out_for_delivery" && order.expectedDelivery ? `Expected delivery: ${order.expectedDelivery}` : "",
    addressText(order),
    "Production time is separate from carrier transit.",
    `Questions: ${SUPPORT_EMAIL}${order.supportUrl ? ` or ${order.supportUrl}` : ""}`,
    "",
    socialPlainText(),
  ].filter((line) => line !== "").join("\n");
  return { subject, html, text };
}

export function templateOrder(origin: string): EmailOrder {
  return {
    orderNumber: "1042",
    customerName: "KAPO customer",
    customerEmail: "customer@example.com",
    currency: "usd",
    merchandiseSubtotalCents: 1898,
    discountCents: 0,
    discountCode: null,
    shippingCents: 540,
    taxCents: 0,
    totalCents: 2438,
    refundedCents: 0,
    paymentStatus: "paid",
    productionStatus: "awaiting_production",
    shippingStatus: "quoted",
    carrier: "USPS",
    serviceName: "Ground Advantage",
    trackingNumber: "Tracking number",
    trackingUrl: `${origin}/shipping-returns`,
    shipLine1: "Shipping address",
    shipCity: "Philadelphia",
    shipState: "PA",
    shipPostalCode: "19103",
    shipCountry: "US",
    orderUrl: `${origin}/account/orders/1042`,
    supportUrl: `${origin}/contact`,
    logoUrl: `${origin}/kapo-wordmark.png`,
    expectedDelivery: "Thursday, October 22",
    items: [
      { name: "Spore — Flat Keycap", quantity: 1, lineTotalCents: 699, image: `${origin}/products/spore-flat.png` },
      { name: "Orbit — Artisan Keycap", quantity: 1, lineTotalCents: 1199, image: `${origin}/products/orbit-artisan.png` },
    ],
  };
}

function headingFor(template: EmailTemplate) {
  const headings: Record<EmailTemplate, string> = {
    payment_confirmation: "Payment received",
    order_confirmation: "Your order is confirmed",
    production_started: "We're making your new friends",
    order_ready_to_ship: "Packed and ready",
    shipment_confirmation: "Your KAPO package has launched",
    out_for_delivery: "Your new friends are almost home",
    tracking_update: "Tracking update",
    delivery_exception: "The carrier hit a snag",
    returned_shipment: "Your package is coming back",
    delivery_confirmation: "Your KAPO order has arrived",
    refund_confirmation: "Your refund is confirmed",
    payment_failed: "Payment did not complete",
    order_canceled: "Your order was canceled",
  };
  return headings[template];
}

function subjectFor(template: EmailTemplate, orderNumber: string) {
  const subjects: Record<EmailTemplate, string> = {
    payment_confirmation: `Payment received for ${orderNumber}`,
    order_confirmation: `Your KAPO order ${orderNumber} is confirmed`,
    production_started: `We're making your new friends · ${orderNumber}`,
    order_ready_to_ship: `${orderNumber} is packed and ready`,
    shipment_confirmation: `Your KAPO package has launched · ${orderNumber}`,
    out_for_delivery: `Your new friends are almost home · ${orderNumber}`,
    tracking_update: `Tracking update for ${orderNumber}`,
    delivery_exception: `Delivery update for ${orderNumber}`,
    returned_shipment: `A return update for ${orderNumber}`,
    delivery_confirmation: `Your KAPO order ${orderNumber} has arrived`,
    refund_confirmation: `Refund confirmed for ${orderNumber}`,
    payment_failed: `Payment did not complete for ${orderNumber}`,
    order_canceled: `Order ${orderNumber} was canceled`,
  };
  return subjects[template];
}

function introFor(template: EmailTemplate, order: EmailOrder, detail: string) {
  const name = order.customerName.trim() || "there";
  const note = humanDetail(detail);
  const carrier = order.carrier ?? "The carrier";
  const service = order.serviceName ? ` (${order.serviceName})` : "";
  switch (template) {
    case "payment_confirmation":
      return [`Thanks, ${name}. Stripe confirmed your payment for order ${order.orderNumber}.`];
    case "order_confirmation":
      return [`${name}, your KAPO order is confirmed. We'll email you when printing starts, and again when the carrier has the package.`];
    case "production_started":
      return [
        `${name}, Gloop is on the bench. KAPO is printing and checking this order now.`,
        `Making and packing usually takes ${productionWindow} after payment. Carrier transit is separate and depends on the shipping service you chose.`,
      ];
    case "order_ready_to_ship":
      return ["Your order is packed. A shipping label is not the same as the carrier having the package. You'll get another email when it is on the way."];
    case "shipment_confirmation":
      return [`${name}, your order was handed to ${carrier}${service}.`];
    case "out_for_delivery":
      return [`${name}, the carrier marked this shipment out for delivery.`];
    case "tracking_update":
      return [note || "The carrier posted a tracking update."];
    case "delivery_exception":
      return [note || `${carrier} reported a problem delivering order ${order.orderNumber}. KAPO support can help.`];
    case "returned_shipment":
      return [note || `${carrier} is sending this package back. Contact KAPO support and include order ${order.orderNumber}.`];
    case "delivery_confirmation":
      return [
        `${name}, the carrier confirmed delivery.`,
        "Press a flat keycap onto an MX-style switch. Artisan keycaps include one switch. If something arrived wrong, KAPO support can help.",
        "Reply to this email if you want to tell us how they look on your desk.",
      ];
    case "refund_confirmation":
      return [`Stripe confirmed a refund of ${formatCents(order.refundedCents, order.currency)} for order ${order.orderNumber}. It goes back to the original payment method. Card issuers usually post it within 5 to 10 business days.`];
    case "payment_failed":
      return ["Stripe reported that this payment did not complete. KAPO has not marked the order paid."];
    case "order_canceled":
      return [`Order ${order.orderNumber} was canceled. If Stripe captured a payment, the refund email arrives separately once Stripe confirms it.`];
    default:
      return ["There is an update on your KAPO order."];
  }
}

function actionsFor(template: EmailTemplate, order: EmailOrder) {
  const viewLabel = `View order ${order.orderNumber}`;
  const trackLabel = `Track ${order.trackingNumber ?? "shipment"}`;
  const html: string[] = [];
  const text: string[] = [];
  const push = (label: string, href: string | undefined, primary: boolean) => {
    if (!href || !safeHttpUrl(href)) return;
    html.push(primary ? emailButton(label, href) : emailLink(label, href));
    text.push(`${label}: ${href}`);
  };
  if (template === "delivery_confirmation") {
    push("Contact KAPO Support", order.supportUrl, true);
    push(viewLabel, order.orderUrl, false);
    return { html: html.join(""), text };
  }
  if (template === "payment_failed") {
    push("Contact KAPO", order.supportUrl, true);
    return { html: html.join(""), text };
  }
  if (showsTracking(template) && order.trackingUrl) {
    push(trackLabel, order.trackingUrl, true);
    if (template === "delivery_exception" || template === "returned_shipment") {
      push("Contact KAPO Support", order.supportUrl, false);
    }
    push(viewLabel, order.orderUrl, false);
    return { html: html.join(""), text };
  }
  push(viewLabel, order.orderUrl, true);
  return { html: html.join(""), text };
}

function bodyFor(template: EmailTemplate, order: EmailOrder, origin: string) {
  const blocks: string[] = [];
  if (template === "production_started") {
    blocks.push(emailNote("Preparation", `${productionWindow} to print and pack. Transit time is extra.`));
  }
  if (template === "out_for_delivery" && order.expectedDelivery?.trim()) {
    blocks.push(emailFacts([["Expected delivery", order.expectedDelivery.trim()]]));
  }
  if (showsTracking(template)) blocks.push(trackingCard(order));
  blocks.push(receiptHtml(order, origin));
  blocks.push(addressHtml(order));
  return blocks.filter(Boolean).join("");
}

function showsTracking(template: EmailTemplate) {
  return template === "shipment_confirmation"
    || template === "out_for_delivery"
    || template === "tracking_update"
    || template === "delivery_confirmation"
    || template === "delivery_exception"
    || template === "returned_shipment";
}

function trackingCard(order: EmailOrder) {
  if (!order.trackingNumber && !order.carrier) return "";
  return emailFacts([
    ["Carrier", order.carrier ?? ""],
    ["Service", order.serviceName ?? ""],
    ["Tracking number", order.trackingNumber ?? ""],
  ]);
}

function receiptHtml(order: EmailOrder, origin: string) {
  const rows = order.items.map((item) => lineRow(item, order.currency, origin)).join("");
  const totals = [
    totalRow("Subtotal", formatCents(order.merchandiseSubtotalCents, order.currency)),
    order.discountCents > 0 ? totalRow("Discount", `${formatCents(order.discountCents, order.currency)}${order.discountCode ? ` (${order.discountCode})` : ""}`) : "",
    totalRow("Shipping", formatCents(order.shippingCents, order.currency)),
    totalRow("Tax", formatCents(order.taxCents, order.currency)),
    totalRow("Total", formatCents(order.totalCents, order.currency), true),
  ].join("");
  const refund = order.refundedCents > 0 ? totalRow("Refunded", formatCents(order.refundedCents, order.currency), true) : "";
  return `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#5E6168;">Your order</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E6E6E6;">
  ${rows}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 18px;">
  ${totals}
  ${refund}
</table>`;
}

function lineRow(item: EmailLine, currency: string, origin: string) {
  const image = itemImage(item.image, origin);
  const thumb = image
    ? `<td width="76" valign="middle" style="padding:12px 12px 12px 0;border-bottom:1px solid #E6E6E6;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFF0F2" style="background:#FFF0F2;"><tr><td style="padding:4px;"><img src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}" width="64" style="display:block;border:0;width:64px;max-width:64px;height:auto;" /></td></tr></table>
    </td>`
    : "";
  return `<tr>
    ${thumb}
    <td valign="middle" style="padding:12px 8px;border-bottom:1px solid #E6E6E6;font-family:${FONT};font-size:15px;line-height:1.4;color:#111111;">${escapeHtml(item.name)}</td>
    <td align="right" valign="middle" style="padding:12px 8px;border-bottom:1px solid #E6E6E6;font-family:${FONT};font-size:14px;color:#111111;">${item.quantity}</td>
    <td align="right" valign="middle" style="padding:12px 0;border-bottom:1px solid #E6E6E6;font-family:${FONT};font-size:14px;font-weight:700;color:#111111;">${formatCents(item.lineTotalCents, currency)}</td>
  </tr>`;
}

function totalRow(label: string, value: string, strong = false) {
  const weight = strong ? "700" : "400";
  const bg = strong ? "background:#FFF0F2;" : "";
  return `<tr>
    <td bgcolor="${strong ? "#FFF0F2" : "#FFFFFF"}" style="padding:6px 8px;${bg}font-family:${FONT};font-size:14px;font-weight:${weight};color:#111111;">${escapeHtml(label)}</td>
    <td align="right" bgcolor="${strong ? "#FFF0F2" : "#FFFFFF"}" style="padding:6px 8px;${bg}font-family:${FONT};font-size:14px;font-weight:${weight};color:#111111;">${escapeHtml(value)}</td>
  </tr>`;
}

function addressHtml(order: EmailOrder) {
  const lines = [order.shipLine1, order.shipLine2, [order.shipCity, order.shipState, order.shipPostalCode].filter(Boolean).join(", "), order.shipCountry].filter(Boolean);
  if (!lines.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;border:1px solid #E6E6E6;">
    <tr>
      <td style="padding:14px 16px;font-family:${FONT};font-size:14px;line-height:1.5;color:#111111;">
        <span style="display:block;margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5E6168;">Ships to</span>
        ${lines.map((line) => escapeHtml(line ?? "")).join("<br />")}
      </td>
    </tr>
  </table>`;
}

function addressText(order: EmailOrder) {
  const lines = [order.shipLine1, order.shipLine2, [order.shipCity, order.shipState, order.shipPostalCode].filter(Boolean).join(", "), order.shipCountry].filter(Boolean);
  return lines.length ? `Ships to\n${lines.join("\n")}` : "";
}

function itemImage(image: string | null | undefined, origin: string) {
  if (!image) return "";
  if (image.startsWith("https://") || image.startsWith("http://")) return safeHttpUrl(image);
  if (image.startsWith("/")) return `${origin}${image}`;
  return "";
}

function humanDetail(detail: string) {
  const trimmed = detail.trim();
  if (!trimmed || /^(UNKNOWN|TRANSIT|IN_TRANSIT|PRE_TRANSIT|FAILURE|RETURNED)$/i.test(trimmed)) return "";
  return trimmed;
}
