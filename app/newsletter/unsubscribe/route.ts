import { unsubscribeToken } from "@/lib/email/newsletter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return respond(new URL(request.url).searchParams.get("token") ?? "");
}

export async function POST(request: Request) {
  const urlToken = new URL(request.url).searchParams.get("token") ?? "";
  const form = await request.text();
  const bodyToken = new URLSearchParams(form).get("token") ?? "";
  return respond(urlToken || bodyToken);
}

async function respond(token: string) {
  const result = await unsubscribeToken(token);
  const message = result.ok
    ? "This address will no longer receive KAPO news. Order and support email is unchanged."
    : result.message;
  return new Response(page(message), { headers: { "content-type": "text/html; charset=utf-8" } });
}

function page(message: string) {
  return `<!doctype html><html lang="en"><head><style>@font-face{font-family:Fredoka;src:url("/fonts/Fredoka-Variable.ttf") format("truetype");font-weight:300 700;font-style:normal;font-display:swap}</style></head><body style="margin:0;background:#f4f4f4;color:#101113;font-family:Fredoka,Helvetica,Arial,sans-serif"><main style="max-width:560px;margin:48px auto;background:#fff;padding:32px;border:1px solid #e5e5e5"><img src="/kapo-wordmark.png" alt="KAPO" width="140" height="40"><h1>Unsubscribe</h1><p>${escapeHtml(message)}</p><p><a href="/">Back to KAPO</a></p></main></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}
