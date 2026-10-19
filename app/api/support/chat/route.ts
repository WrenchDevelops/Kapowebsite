import { getMacropadLaunch } from "@/lib/commerce/launch";
import { supportConfig } from "@/lib/support/config";
import { productsMentioned, supportKnowledge } from "@/lib/support/knowledge";
import { modelMessages, systemPrompt } from "@/lib/support/prompt";
import { readSupportSession } from "@/lib/support/session";
import { addMessage } from "@/lib/support/store";
import type { TranscriptMessage } from "@/lib/support/types";

export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();

export async function POST(request: Request) {
  const config = supportConfig();
  if (!config.visible) {
    return Response.json({ message: "Chat is turned off." }, { status: 404 });
  }

  let body: { messages?: unknown };
  try {
    body = await request.json() as { messages?: unknown };
  } catch {
    return Response.json({ message: "Send a message to continue." }, { status: 400 });
  }

  const session = await readSupportSession();
  if (!session) return Response.json({ message: "Enter your email to start the chat." }, { status: 401 });

  const messages = sanitize(body.messages, config.maxHistory, config.maxInputChars);
  const latest = messages.at(-1);
  if (!latest || latest.role !== "user") {
    return Response.json({ message: "Send a message to continue." }, { status: 400 });
  }

  await addMessage(session.id, "user", latest.content);

  if (!allow(clientKey(request), config.ipRequests, config.ipWindowMs)) {
    return answer(session.id, "You've sent several messages in a short time. Wait a few minutes, or use Get help from a person in this chat.", 429);
  }

  if (!config.enabled || !config.apiKey || !config.model) {
    return answer(session.id, "I can open the chat, but replies are not connected on this server yet. Use Get help from a person and KAPO will reply.");
  }

  const launch = await getMacropadLaunch();
  const knowledge = supportKnowledge(launch, config.supportEmail);
  const history = messages.slice(0, -1).map((message) => ({ ...message, at: Date.now() }));

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": config.appName,
        ...(config.siteUrl ? { "HTTP-Referer": config.siteUrl } : {}),
      },
      signal: AbortSignal.timeout(config.timeoutMs),
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxOutputTokens,
        reasoning: { effort: "none" },
        messages: modelMessages(systemPrompt(knowledge.text, config), history, latest.content),
      }),
    });
    if (!response.ok) {
      return answer(session.id, "I couldn't get a reply just now. Use Get help from a person and KAPO will reply.", 502);
    }
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const reply = String(payload.choices?.[0]?.message?.content ?? "").trim().slice(0, 2000);
    if (!reply) return answer(session.id, "I don't have a reply for that. Use Get help from a person and KAPO will reply.");
    return answer(session.id, reply, 200, productsMentioned(reply, knowledge.products));
  } catch {
    return answer(session.id, "The reply took too long. Use Get help from a person and KAPO will reply.", 504);
  }
}

async function answer(conversationId: string, reply: string, status = 200, products: ReturnType<typeof productsMentioned> = []) {
  await addMessage(conversationId, "assistant", reply);
  return Response.json({ reply, products }, { status });
}

function sanitize(value: unknown, maxHistory: number, maxInputChars: number): TranscriptMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as { role?: unknown }).role;
      const content = String((item as { content?: unknown }).content ?? "").replace(/\r\n/g, "\n").trim();
      if ((role !== "user" && role !== "assistant") || !content) return null;
      return { role, content: content.slice(0, maxInputChars), at: 0 };
    })
    .filter((item): item is TranscriptMessage => Boolean(item))
    .slice(-maxHistory);
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0]?.trim() || "local";
}

function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
