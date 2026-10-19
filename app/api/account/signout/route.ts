import { cookies } from "next/headers";
import { authenticateShopRequest, clerkBackend, requireSameOrigin } from "@/lib/auth/server";
export async function POST(request: Request) {
  try { requireSameOrigin(request); } catch { return Response.json({ message: "Invalid request origin." }, { status: 403 }); }
  const user = await authenticateShopRequest(request);
  if (user) await clerkBackend().sessions.revokeSession(user.sessionId);
  const jar = await cookies();
  jar.delete("kapo-account");
  jar.delete("__session");
  return Response.json({ ok: true });
}
