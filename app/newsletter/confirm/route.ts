import { confirmSubscription } from "@/lib/email/newsletter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await confirmSubscription(token);
  const message = result.ok
    ? "You're confirmed for KAPO news. Orders and support mail stay separate from this list."
    : result.message;
  const extra = result.ok
    ? `<p><a href="${escapeHtml(result.preferencesUrl)}">Choose what you hear about</a></p>`
    : "";
  return new Response(page("KAPO news", message, extra), { headers: { "content-type": "text/html; charset=utf-8" } });
}

function page(title: string, message: string, extra = "") {
  return `<!doctype html><html lang="en"><head><style>@font-face{font-family:Fredoka;src:url("/fonts/Fredoka-Variable.ttf") format("truetype");font-weight:300 700;font-style:normal;font-display:swap}</style></head><body style="margin:0;background:#f4f4f4;color:#101113;font-family:Fredoka,Helvetica,Arial,sans-serif"><main style="max-width:560px;margin:48px auto;background:#fff;padding:32px;border:1px solid #e5e5e5"><img src="/kapo-wordmark.png" alt="KAPO" width="140" height="40"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${extra}<p><a href="/shop">Back to the shop</a></p></main></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}
