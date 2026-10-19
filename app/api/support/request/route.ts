import { commerceEnv } from "@/lib/commerce/env";
import { publicSiteUrl } from "@/lib/email/addresses";
import { sendResendEmail } from "@/lib/email/client";
import { renderSupportAck, renderSupportTeam } from "@/lib/email/messages";
import { readSupportSession } from "@/lib/support/session";
import { findRequest, findSentDuplicate, listMessages, recentRequestCount, saveRequest, supportInbox } from "@/lib/support/store";
import { parseSupportRequest } from "@/lib/support/validate";

export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();

export async function POST(request: Request) {
  const session = await readSupportSession();
  if (!session) return Response.json({ message: "Enter your email before contacting support." }, { status: 401 });

  let body: { message?: unknown; idempotencyKey?: unknown; company?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ message: "Enter how we can help." }, { status: 400 });
  }
  if (String(body.company ?? "").trim()) return Response.json({ message: "Message could not be sent." }, { status: 400 });

  const parsed = parseSupportRequest(body);
  if (!parsed) {
    return Response.json({ message: "Enter how we can help." }, { status: 400 });
  }
  const { message, idempotencyKey } = parsed;

  const existing = await findRequest(idempotencyKey);
  if (existing?.status === "sent") return Response.json({ ok: true, already: true });
  const duplicate = await findSentDuplicate(session.id, message, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (duplicate) return Response.json({ ok: true, already: true });

  const ip = clientKey(request);
  if (!allow(ip) || !allow(session.email)) {
    return Response.json({ message: "Please wait a few minutes before sending another request." }, { status: 429 });
  }
  const sentRecently = await recentRequestCount(session.email, new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (sentRecently >= 5) {
    return Response.json({ message: "Please wait a few minutes before sending another request." }, { status: 429 });
  }

  const transcript = await listMessages(session.id);
  const requestId = existing?.id ?? crypto.randomUUID();
  const settings = commerceEnv();
  const inbox = supportInbox();
  if (!settings.resendKey) {
    await saveRequest({
      id: requestId,
      conversationId: session.id,
      email: session.email,
      message,
      transcript,
      status: "failed",
      error: "email_provider_not_configured",
      idempotencyKey,
    });
    return Response.json({ message: "KAPO could not send that request. Email support@shopkapo.com and include your order number." }, { status: 503 });
  }

  await saveRequest({
    id: requestId,
    conversationId: session.id,
    email: session.email,
    message,
    transcript,
    status: "pending",
    idempotencyKey,
  });

  const origin = publicSiteUrl(settings.publicSiteUrl);
  const reference = requestId.slice(0, 8).toUpperCase();
  const submittedAt = new Date().toISOString();
  const team = renderSupportTeam({ origin, email: session.email, message, reference, submittedAt, transcript });
  const sent = await sendResendEmail({
    apiKey: settings.resendKey,
    from: inbox.from,
    to: [inbox.to],
    replyTo: session.email,
    subject: team.subject,
    text: team.text,
    html: team.html,
    idempotencyKey: `support:${idempotencyKey}`,
  });
  if (!sent.ok) {
    await saveRequest({
      id: requestId,
      conversationId: session.id,
      email: session.email,
      message,
      transcript,
      status: "failed",
      error: sent.error,
      idempotencyKey,
    });
    return Response.json({ message: "KAPO could not send that request. Email support@shopkapo.com and include your order number." }, { status: 502 });
  }

  const ackMessage = renderSupportAck({ origin, email: session.email, message, reference });
  const ack = await sendResendEmail({
    apiKey: settings.resendKey,
    from: inbox.from,
    to: [session.email],
    subject: ackMessage.subject,
    text: ackMessage.text,
    html: ackMessage.html,
    idempotencyKey: `support-ack:${idempotencyKey}`,
  });
  await saveRequest({
    id: requestId,
    conversationId: session.id,
    email: session.email,
    message,
    transcript,
    status: "sent",
    resendId: sent.id,
    error: null,
    ackStatus: ack.ok ? "sent" : "failed",
    ackError: ack.ok ? null : ack.error,
    idempotencyKey,
  });
  return Response.json({ ok: true });
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0]?.trim() || "local";
}

function allow(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 5) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
