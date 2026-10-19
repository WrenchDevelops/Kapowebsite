import { commerceEnv } from "@/lib/commerce/env";
import { applyResendContact, applyResendEvent } from "@/lib/email/newsletter";
import { verifyResendWebhook } from "@/lib/email/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.text();
  const settings = commerceEnv();
  if (!settings.resendWebhookSecret) {
    return Response.json({ message: "Resend webhooks are not configured." }, { status: 503 });
  }
  const valid = await verifyResendWebhook({
    secret: settings.resendWebhookSecret,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    payload,
  });
  if (!valid) return Response.json({ message: "Invalid Resend signature." }, { status: 400 });
  let event: { type?: string; data?: { email_id?: string; email?: string; unsubscribed?: boolean } };
  try {
    event = JSON.parse(payload) as { type?: string; data?: { email_id?: string; email?: string; unsubscribed?: boolean } };
  } catch {
    return Response.json({ message: "Invalid Resend payload." }, { status: 400 });
  }
  if (event.type === "contact.updated" || event.type === "contact.deleted") {
    await applyResendContact({
      email: event.data?.email,
      unsubscribed: event.type === "contact.deleted" || event.data?.unsubscribed === true,
    });
    return Response.json({ received: true });
  }
  await applyResendEvent(event.type ?? "", event.data?.email_id ?? "");
  return Response.json({ received: true });
}
