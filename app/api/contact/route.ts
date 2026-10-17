import { commerceEnv, readEnv } from "@/lib/commerce/env";
import { readJson } from "@/lib/commerce/http";
import { SUPPORT_EMAIL } from "@/lib/store-facts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request) as { name?: string; email?: string; order?: string; message?: string };
  const name = oneLine(body.name, 80);
  const email = oneLine(body.email, 120).toLowerCase();
  const order = oneLine(body.order, 40);
  const message = String(body.message ?? "").replace(/\r\n/g, "\n").trim().slice(0, 4000);
  const inbox = readEnv("KAPO_SUPPORT_EMAIL")?.trim() || SUPPORT_EMAIL;

  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 4) {
    return Response.json({ message: "Enter your name, a valid email, and a message." }, { status: 400 });
  }

  const settings = commerceEnv();
  if (!settings.resendKey || !settings.emailFrom) {
    return Response.json({
      message: `The form could not send. Email ${inbox} and KAPO will reply.`,
      email: inbox,
    }, { status: 503 });
  }

  const text = [
    `From: ${name} <${email}>`,
    order ? `Order: ${order}` : "Order: none given",
    "",
    message,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: settings.emailFrom,
      to: [inbox],
      reply_to: email,
      subject: order ? `KAPO contact · ${order}` : "KAPO contact",
      text,
      html: `<p>${escapeHtml(text).replaceAll("\n", "<br />")}</p>`,
    }),
  });

  if (!response.ok) {
    return Response.json({
      message: `The form could not send. Email ${inbox} and KAPO will reply.`,
      email: inbox,
    }, { status: 502 });
  }

  return Response.json({ message: "Message sent. KAPO will reply to the email you entered." });
}

function oneLine(value: unknown, max: number) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}
