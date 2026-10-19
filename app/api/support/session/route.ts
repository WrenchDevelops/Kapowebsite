import { cookies } from "next/headers";
import { getShopUser } from "@/app/chatgpt-auth";
import { accountCookieOptions } from "@/lib/commerce/local-session";
import { cleanEmail, readSupportSession, sealSupportSession, SUPPORT_COOKIE } from "@/lib/support/session";
import { ensureConversation, listMessages } from "@/lib/support/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const shopUser = await getShopUser();
  const existing = await readSupportSession();
  if (existing) {
    await ensureConversation({ id: existing.id, email: existing.email, userId: shopUser?.email === existing.email ? shopUser.userId : null });
    const messages = await listMessages(existing.id);
    return Response.json({ email: existing.email, messages });
  }
  if (shopUser && cleanEmail(shopUser.email)) {
    const session = { id: crypto.randomUUID(), email: shopUser.email.toLowerCase() };
    await ensureConversation({ id: session.id, email: session.email, userId: shopUser.userId });
    await persist(session);
    return Response.json({ email: session.email, messages: [] });
  }
  return Response.json({ email: null, messages: [] });
}

export async function POST(request: Request) {
  const existing = await readSupportSession();
  if (existing) {
    const messages = await listMessages(existing.id);
    return Response.json({ email: existing.email, messages });
  }
  let body: { email?: unknown };
  try {
    body = await request.json() as { email?: unknown };
  } catch {
    return Response.json({ message: "Enter a valid email address." }, { status: 400 });
  }
  const email = cleanEmail(body.email);
  if (!email) return Response.json({ message: "Enter a valid email address." }, { status: 400 });
  const shopUser = await getShopUser();
  const session = { id: crypto.randomUUID(), email };
  await ensureConversation({
    id: session.id,
    email,
    userId: shopUser?.email.toLowerCase() === email ? shopUser.userId : null,
  });
  await persist(session);
  return Response.json({ email, messages: [] });
}

async function persist(session: { id: string; email: string }) {
  const token = await sealSupportSession(session);
  if (!token) return;
  const secure = process.env.NODE_ENV === "production";
  (await cookies()).set(SUPPORT_COOKIE, token, accountCookieOptions(secure));
}
