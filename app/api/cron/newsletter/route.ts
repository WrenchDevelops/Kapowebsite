import { commerceEnv } from "@/lib/commerce/env";
import { buildWeeklyDigest } from "@/lib/email/engine";
import { sendDueCampaigns } from "@/lib/email/newsletter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const secret = commerceEnv().cronSecret;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) return Response.json({ message: "Unauthorized." }, { status: 401 });
  const sent = await sendDueCampaigns();
  const digest = new Date().getUTCDay() === 1 ? await buildWeeklyDigest() : null;
  return Response.json({ sent, digest });
}
