import { commerceEnv } from "@/lib/commerce/env";
import { ingestAnnouncement } from "@/lib/email/engine";
import { parseYouTubeFeed, youtubeHubChallenge } from "@/lib/email/youtube";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const challenge = youtubeHubChallenge(new URL(request.url).searchParams, commerceEnv().youtubeHubToken);
  if (!challenge) return new Response("Invalid subscription.", { status: 404 });
  return new Response(challenge, { headers: { "content-type": "text/plain" } });
}

export async function POST(request: Request) {
  const channelId = commerceEnv().youtubeChannelId;
  const videos = parseYouTubeFeed(await request.text());
  if (!channelId) return new Response("ok");
  for (const video of videos) {
    if (video.channelId !== channelId) continue;
    await ingestAnnouncement({
      kind: "youtube",
      dedupeKey: `youtube:${video.videoId}`,
      title: video.title,
      summary: video.url.includes("/shorts/") ? "A new KAPO Short is up." : "A new KAPO video is up.",
      linkUrl: video.url,
    });
  }
  return new Response("ok");
}
