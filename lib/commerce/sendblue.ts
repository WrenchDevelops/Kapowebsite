import type { EmailTemplate } from "./status.ts";

const TEXT_TEMPLATES = new Set<EmailTemplate>([
  "order_confirmation",
  "production_started",
  "shipment_confirmation",
  "delivery_confirmation",
  "refund_confirmation",
]);

export function toE164Us(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10 || national.startsWith("0") || national.startsWith("1")) return null;
  return `+1${national}`;
}

export function orderUpdateText(template: EmailTemplate, order: { orderNumber: string; carrier: string | null; trackingUrl: string | null }) {
  if (!TEXT_TEMPLATES.has(template)) return null;
  switch (template) {
    case "order_confirmation":
      return `KAPO: Order ${order.orderNumber} is confirmed. We'll text you when printing starts and when it ships.`;
    case "production_started":
      return `KAPO: Order ${order.orderNumber} is in production.`;
    case "shipment_confirmation": {
      const carrier = order.carrier ? ` with ${order.carrier}` : "";
      const tracking = order.trackingUrl ? ` Track it: ${order.trackingUrl}` : "";
      return `KAPO: Order ${order.orderNumber} is on the way${carrier}.${tracking}`;
    }
    case "delivery_confirmation":
      return `KAPO: Order ${order.orderNumber} was delivered.`;
    case "refund_confirmation":
      return `KAPO: A refund was recorded for order ${order.orderNumber}.`;
    default:
      return null;
  }
}

export async function deliverText(options: {
  apiKey: string;
  apiSecret: string;
  from: string;
  to: string;
  content: string;
  fetchImpl?: typeof fetch;
}) {
  const from = toE164Us(options.from);
  const to = toE164Us(options.to);
  if (!options.apiKey || !options.apiSecret || !from || !to) {
    return { status: "skipped" as const, error: "sendblue_not_configured" };
  }
  const response = await (options.fetchImpl ?? fetch)("https://api.sendblue.co/api/send-message", {
    method: "POST",
    headers: {
      "sb-api-key-id": options.apiKey,
      "sb-api-secret-key": options.apiSecret,
      "content-type": "application/json",
    },
    body: JSON.stringify({ number: to, from_number: from, content: options.content }),
  });
  if (!response.ok) return { status: "failed" as const, error: "sendblue_rejected" };
  return { status: "sent" as const, error: null };
}
