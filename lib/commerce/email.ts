import { sender } from "../email/addresses.ts";
import { sendResendEmail } from "../email/client.ts";
import { renderEmail, type EmailOrder } from "./email-template.ts";
import type { EmailTemplate } from "./status.ts";

export async function deliverEmail(options: {
  apiKey: string;
  from?: string;
  order: EmailOrder;
  template: EmailTemplate;
  detail?: string;
  idempotencyKey?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  pace?: boolean;
}) {
  const message = renderEmail(options.template, options.order, options.detail);
  if (!options.apiKey) {
    return { status: "queued" as const, provider: null, subject: message.subject, error: "email_provider_not_configured", id: null };
  }
  const sent = await sendResendEmail({
    apiKey: options.apiKey,
    from: options.from || sender("orders"),
    to: [options.order.customerEmail],
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: options.idempotencyKey,
    fetchImpl: options.fetchImpl,
    sleep: options.sleep,
    pace: options.pace,
  });
  if (!sent.ok) {
    return { status: "failed" as const, provider: "resend", subject: message.subject, error: sent.error, id: null };
  }
  return { status: "sent" as const, provider: "resend", subject: message.subject, error: null, id: sent.id };
}
