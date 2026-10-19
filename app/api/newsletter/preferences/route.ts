import { requestPreferenceLink } from "@/lib/email/newsletter";
import { savePreferenceSelection } from "@/lib/email/engine";

export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();

export async function POST(request: Request) {
  let body: { token?: unknown; email?: unknown; company?: unknown; frequency?: unknown; products?: unknown; deals?: unknown; youtube?: unknown; instagram?: unknown; news?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ message: "Those preferences could not be saved." }, { status: 400 });
  }
  if (String(body.company ?? "").trim()) return Response.json({ message: "Those preferences could not be saved." }, { status: 400 });
  if (!allow(clientKey(request))) return Response.json({ message: "Please wait a few minutes before trying again." }, { status: 429 });
  if (!body.token) {
    await requestPreferenceLink(String(body.email ?? ""));
    return Response.json({ message: "If that address is confirmed, KAPO sent a preferences link." });
  }
  const saved = await savePreferenceSelection(String(body.token), {
    products: body.products === true,
    deals: body.deals === true,
    youtube: body.youtube === true,
    instagram: body.instagram === true,
    news: body.news === true,
    frequency: body.frequency,
  });
  if (!saved.ok) return Response.json({ message: saved.message }, { status: 400 });
  return Response.json({ message: "Preferences saved." });
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
