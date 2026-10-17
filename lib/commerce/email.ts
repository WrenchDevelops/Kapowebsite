import { renderEmail, type EmailOrder } from "./email-template.ts";
import type { EmailTemplate } from "./status.ts";

export async function deliverEmail(options: {
  apiKey: string;
  from: string;
  order: EmailOrder;
  template: EmailTemplate;
  detail?: string;
  fetchImpl?: typeof fetch;
}) {
  const message = renderEmail(options.template, options.order, options.detail);
  if (!options.apiKey || !options.from) {
    return { status: "queued" as const, provider: null, subject: message.subject, error: "email_provider_not_configured" };
  }
  const response = await (options.fetchImpl ?? fetch)("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: options.from,
      to: [options.order.customerEmail],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!response.ok) return { status: "failed" as const, provider: "resend", subject: message.subject, error: "email_provider_rejected" };
  return { status: "sent" as const, provider: "resend", subject: message.subject, error: null };
}
