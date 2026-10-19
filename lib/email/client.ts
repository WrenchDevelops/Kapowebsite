import { isEmailAddress } from "./addresses.ts";
import { WORDMARK_BASE64, WORDMARK_CONTENT_ID, WORDMARK_DATA_URI, WORDMARK_FILENAME } from "./wordmark.ts";

const INLINE_IMAGES = [
  { dataUri: WORDMARK_DATA_URI, contentId: WORDMARK_CONTENT_ID, filename: WORDMARK_FILENAME, content: WORDMARK_BASE64 },
];

export type SendEmailInput = {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  pace?: boolean;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string; retryable: boolean };

let paceChain: Promise<void> = Promise.resolve();
let lastSentAt = 0;

export async function sendResendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipients = input.to.map((address) => address.trim().toLowerCase());
  if (!input.apiKey) return { ok: false, error: "email_provider_not_configured", retryable: false };
  if (!recipients.length || recipients.some((address) => !isEmailAddress(address))) {
    return { ok: false, error: "invalid_recipient", retryable: false };
  }
  if (!input.from.includes("@") || !input.subject.trim() || !input.html.trim() || !input.text.trim()) {
    return { ok: false, error: "invalid_message", retryable: false };
  }
  if (input.replyTo && !isEmailAddress(input.replyTo.trim().toLowerCase())) {
    return { ok: false, error: "invalid_reply_to", retryable: false };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  if (input.pace !== false) await pace(sleep);
  const message = inlineEmailImages(input.html);

  let lastError = "email_provider_rejected";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
          ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey.slice(0, 256) } : {}),
        },
        body: JSON.stringify({
          from: input.from,
          to: recipients,
          subject: input.subject,
          html: message.html,
          text: input.text,
          ...(input.replyTo ? { reply_to: input.replyTo.trim().toLowerCase() } : {}),
          ...(input.headers ? { headers: input.headers } : {}),
          ...(message.attachments ? { attachments: message.attachments } : {}),
        }),
      });
    } catch {
      lastError = "resend_unreachable";
      await sleep(200 * 2 ** attempt);
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      lastError = `resend_${response.status}`;
      await sleep(200 * 2 ** attempt);
      continue;
    }
    if (!response.ok) return { ok: false, error: `resend_${response.status}`, retryable: false };
    const json = await response.json() as { id?: string };
    if (!json.id) return { ok: false, error: "resend_missing_id", retryable: false };
    return { ok: true, id: json.id };
  }
  return { ok: false, error: lastError, retryable: true };
}

function inlineEmailImages(html: string) {
  const attachments: { filename: string; content: string; content_id: string }[] = [];
  let next = html;
  for (const image of INLINE_IMAGES) {
    if (!next.includes(image.dataUri)) continue;
    next = next.replaceAll(image.dataUri, `cid:${image.contentId}`);
    attachments.push({ filename: image.filename, content: image.content, content_id: image.contentId });
  }
  return { html: next, attachments: attachments.length ? attachments : undefined };
}

async function pace(sleep: (ms: number) => Promise<void>) {
  const run = paceChain.then(async () => {
    const wait = Math.max(0, lastSentAt + 500 - Date.now());
    if (wait) await sleep(wait);
    lastSentAt = Date.now();
  });
  paceChain = run.then(() => undefined, () => undefined);
  await run;
}
