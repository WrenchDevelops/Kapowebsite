import { subscribeEmail } from "@/lib/email/newsletter";

export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();

export async function POST(request: Request) {
  let body: { email?: unknown; consent?: unknown; source?: unknown; company?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ message: "Enter a valid email address." }, { status: 400 });
  }
  if (String(body.company ?? "").trim()) return Response.json({ message: "That signup could not be saved." }, { status: 400 });
  const key = clientKey(request);
  if (!allow(key)) return Response.json({ message: "Please wait a few minutes before trying again." }, { status: 429 });
  const result = await subscribeEmail({
    email: String(body.email ?? ""),
    consent: body.consent === true,
    source: String(body.source ?? "website"),
  });
  if (!result.ok) return Response.json({ message: result.message }, { status: 400 });
  if (result.status === "confirmed") {
    return Response.json({ message: "This email is already confirmed for KAPO news." });
  }
  return Response.json({ message: "Check your inbox to confirm KAPO news. Nothing is sent until you confirm." });
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0]?.trim() || "local";
}

function allow(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 8) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
