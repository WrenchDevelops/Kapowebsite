import { requireSameOrigin } from "@/lib/auth/server";
import { getAdminUser } from "@/app/admin-auth";
import { shopProducts } from "@/lib/catalog";
import { commerceEnv } from "@/lib/commerce/env";
import { publicSiteUrl } from "@/lib/email/addresses";
import {
  announceCatalogProduct,
  buildWeeklyDigest,
  ingestAnnouncement,
  saveAutomations,
  saveComposedCampaign,
} from "@/lib/email/engine";
import { sendCampaign } from "@/lib/email/newsletter";
import { announcementSlug, defaultAutomations } from "@/lib/email/topics";
import { subscribeYouTubeHub, youtubeVideoId } from "@/lib/email/youtube";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try { requireSameOrigin(request); } catch { return Response.json({ message: "Invalid request origin." }, { status: 403 }); }
  const admin = await getAdminUser();
  if (!admin) return Response.json({ message: "Admin access is required." }, { status: 403 });
  const body = await request.json() as Record<string, string | undefined>;
  switch (body.action) {
    case "save_automations":
    case "reset_automations": {
      const source: Record<string, string | undefined> = body.action === "reset_automations" ? { ...defaultAutomations() } : body;
      await saveAutomations(source);
      return Response.json({ ok: true });
    }
    case "announce": {
      const result = await announce(body);
      if (!result.ok) return Response.json(result, { status: 400 });
      if ("duplicate" in result && result.duplicate) return Response.json(result, { status: 409 });
      return Response.json({ ok: true });
    }
    case "save_announcement": {
      const saved = await saveComposedCampaign({
        id: body.id,
        subject: body.subject ?? "",
        preheader: body.preheader ?? "",
        headline: body.headline ?? "",
        intro: body.intro ?? "",
        kicker: body.kicker ?? "",
        blockTitle: body.blockTitle ?? "",
        blockBody: body.blockBody ?? "",
        blockImage: body.blockImage ?? "",
        blockUrl: body.blockUrl ?? "",
        blockCta: body.blockCta ?? "",
        blockPrice: body.blockPrice ?? "",
        kind: body.kind ?? "news",
      });
      return Response.json(saved, { status: saved.ok ? 200 : 400 });
    }
    case "send_campaign": {
      const result = await sendCampaign(body.id ?? "");
      return Response.json(result, { status: result.ok ? 200 : 400 });
    }
    case "run_digest": {
      const result = await buildWeeklyDigest({ force: true });
      if (!result.ok) return Response.json(result, { status: 400 });
      return Response.json({ ok: true });
    }
    case "youtube_subscribe": {
      const settings = commerceEnv();
      if (!settings.youtubeChannelId || !settings.youtubeHubToken) {
        return Response.json({ message: "Set KAPO_YOUTUBE_CHANNEL_ID and KAPO_YOUTUBE_HUB_TOKEN first. Until then, add videos by hand." }, { status: 400 });
      }
      const origin = publicSiteUrl(settings.publicSiteUrl);
      const ok = await subscribeYouTubeHub({
        callbackUrl: `${origin}/api/webhooks/youtube`,
        channelId: settings.youtubeChannelId,
        verifyToken: settings.youtubeHubToken,
      });
      if (!ok) return Response.json({ message: "YouTube did not accept the notification subscription." }, { status: 502 });
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ message: "Unknown action." }, { status: 400 });
  }
}

async function announce(body: Record<string, string | undefined>) {
  const force = body.delivery === "draft" || body.delivery === "digest" ? body.delivery : undefined;
  const kind = body.kind ?? "";
  if ((kind === "product_published" || kind === "product_restocked") && body.productId) {
    if (!shopProducts.some((product) => product.id === body.productId)) {
      return { ok: false as const, message: "That product is not in the KAPO shop." };
    }
    return announceCatalogProduct(body.productId, kind, force);
  }
  if (kind === "youtube") {
    const videoId = youtubeVideoId(body.url ?? "");
    if (!videoId) return { ok: false as const, message: "Paste a YouTube video or Shorts link." };
    return ingestAnnouncement({
      kind: "youtube",
      dedupeKey: `youtube:${videoId}`,
      title: body.title?.trim() || "New on YouTube",
      summary: body.summary?.trim() || "A new KAPO video is up.",
      linkUrl: `https://www.youtube.com/watch?v=${videoId}`,
      imageUrl: body.image || undefined,
      force,
    });
  }
  if (kind === "instagram" || kind === "promotion" || kind === "news") {
    const title = body.title?.trim() || "";
    const link = kind === "instagram" ? (body.url ?? "") : (body.url || "/shop");
    const dedupeKey = kind === "instagram"
      ? `instagram:${announcementSlug(body.url ?? title)}`
      : `${kind}:${announcementSlug(title)}`;
    return ingestAnnouncement({
      kind,
      dedupeKey,
      title,
      summary: body.summary ?? "",
      linkUrl: link,
      imageUrl: body.image || undefined,
      priceLabel: body.priceLabel || undefined,
      force,
    });
  }
  return { ok: false as const, message: "Choose a product, promotion, video, post, or news item." };
}
