export function youtubeVideoId(value: string) {
  const trimmed = value.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const watch = url.searchParams.get("v") ?? "";
      if (/^[\w-]{11}$/.test(watch)) return watch;
      const shorts = url.pathname.match(/\/shorts\/([\w-]{11})/);
      if (shorts) return shorts[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function parseYouTubeFeed(xml: string) {
  const videos: { videoId: string; title: string; url: string; channelId: string }[] = [];
  for (const entry of xml.split(/<entry\b/i).slice(1)) {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1]?.trim() ?? "";
    const title = decodeXml(entry.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "");
    const alternate = entry.match(/<link\b[^>]*rel="alternate"[^>]*href="([^"]+)"/i)?.[1]
      ?? entry.match(/<link\b[^>]*href="([^"]+)"[^>]*rel="alternate"/i)?.[1]
      ?? "";
    const channelId = entry.match(/<yt:channelId>([^<]+)<\/yt:channelId>/i)?.[1]?.trim() ?? "";
    if (!/^[\w-]{11}$/.test(videoId) || !title) continue;
    videos.push({
      videoId,
      title: title.slice(0, 140),
      url: alternate || `https://www.youtube.com/watch?v=${videoId}`,
      channelId,
    });
  }
  return videos;
}

export function youtubeHubChallenge(params: URLSearchParams, verifyToken: string) {
  const mode = params.get("hub.mode");
  if (mode !== "subscribe" && mode !== "unsubscribe") return null;
  if (!verifyToken || params.get("hub.verify_token") !== verifyToken) return null;
  const challenge = params.get("hub.challenge") ?? "";
  if (!challenge || challenge.length > 400) return null;
  return challenge;
}

export async function subscribeYouTubeHub(input: {
  callbackUrl: string;
  channelId: string;
  verifyToken: string;
  fetchImpl?: typeof fetch;
}) {
  const body = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.topic": `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${input.channelId}`,
    "hub.callback": input.callbackUrl,
    "hub.verify": "async",
    "hub.verify_token": input.verifyToken,
  });
  const response = await (input.fetchImpl ?? fetch)("https://pubsubhubbub.appspot.com/subscribe", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  return response.status === 202 || response.status === 204 || response.ok;
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}
