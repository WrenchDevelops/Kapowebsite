import { and, desc, eq, gt } from "drizzle-orm";
import { ensureCommerceSchema } from "../../db/migrate.ts";
import { getDb } from "../../db/index.ts";
import { supportConversations, supportMessages, supportRequests } from "../../db/schema.ts";
import type { TranscriptMessage } from "./types.ts";

const SUPPORT_INBOX = "support@shopkapo.com";
const FROM = "KAPO Support <support@shopkapo.com>";

export function supportInbox() {
  return { to: SUPPORT_INBOX, from: FROM };
}

export async function ensureConversation(input: { id: string; email: string; userId?: string | null }) {
  await ensureCommerceSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const existing = await db.select().from(supportConversations).where(eq(supportConversations.id, input.id)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(supportConversations).values({
    id: input.id,
    email: input.email,
    userId: input.userId ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return { id: input.id, email: input.email, userId: input.userId ?? null, createdAt: now, updatedAt: now };
}

export async function listMessages(conversationId: string): Promise<TranscriptMessage[]> {
  await ensureCommerceSchema();
  const rows = await getDb().select().from(supportMessages)
    .where(eq(supportMessages.conversationId, conversationId))
    .orderBy(desc(supportMessages.createdAt))
    .limit(40);
  return rows.reverse().map((row) => ({
    role: row.role === "assistant" ? "assistant" as const : "user" as const,
    content: row.content,
    at: Date.parse(row.createdAt) || Date.now(),
  }));
}

export async function addMessage(conversationId: string, role: "user" | "assistant", content: string) {
  await ensureCommerceSchema();
  const now = new Date().toISOString();
  await getDb().insert(supportMessages).values({
    id: crypto.randomUUID(),
    conversationId,
    role,
    content: content.slice(0, 2000),
    createdAt: now,
  });
  await getDb().update(supportConversations).set({ updatedAt: now }).where(eq(supportConversations.id, conversationId));
}

export async function recentRequestCount(email: string, sinceIso: string) {
  await ensureCommerceSchema();
  const rows = await getDb().select({ id: supportRequests.id }).from(supportRequests)
    .where(and(eq(supportRequests.email, email), gt(supportRequests.createdAt, sinceIso)));
  return rows.length;
}

export async function findRequest(idempotencyKey: string) {
  await ensureCommerceSchema();
  const rows = await getDb().select().from(supportRequests).where(eq(supportRequests.idempotencyKey, idempotencyKey)).limit(1);
  return rows[0] ?? null;
}

export async function findSentDuplicate(conversationId: string, message: string, sinceIso: string) {
  await ensureCommerceSchema();
  const rows = await getDb().select().from(supportRequests).where(and(
    eq(supportRequests.conversationId, conversationId),
    eq(supportRequests.message, message),
    eq(supportRequests.status, "sent"),
    gt(supportRequests.createdAt, sinceIso),
  )).limit(1);
  return rows[0] ?? null;
}

export async function saveRequest(input: {
  id: string;
  conversationId: string;
  email: string;
  message: string;
  transcript: TranscriptMessage[];
  status: "pending" | "sent" | "failed";
  resendId?: string | null;
  error?: string | null;
  ackStatus?: string | null;
  ackError?: string | null;
  idempotencyKey: string;
}) {
  await ensureCommerceSchema();
  const now = new Date().toISOString();
  const values = {
    conversationId: input.conversationId,
    email: input.email,
    message: input.message,
    transcriptJson: JSON.stringify(input.transcript.slice(-12)),
    status: input.status,
    resendId: input.resendId ?? null,
    error: input.error ?? null,
    ackStatus: input.ackStatus ?? null,
    ackError: input.ackError ?? null,
    updatedAt: now,
  };
  const existing = await findRequest(input.idempotencyKey);
  if (existing) {
    await getDb().update(supportRequests).set(values).where(eq(supportRequests.id, existing.id));
    return existing.id;
  }
  await getDb().insert(supportRequests).values({
    id: input.id,
    idempotencyKey: input.idempotencyKey,
    resolution: "open",
    createdAt: now,
    ...values,
  });
  return input.id;
}
