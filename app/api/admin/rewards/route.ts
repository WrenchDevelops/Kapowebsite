import { getAdminUser } from "@/app/admin-auth";
import { requireSameOrigin } from "@/lib/auth/server";
import { clubStore, clubEnabled } from "@/lib/club/server";
import { clubError, ClubHttpError } from "@/lib/club/http";
import { readJson } from "@/lib/commerce/http";
export async function POST(request: Request) {
  try {
    try {
      requireSameOrigin(request);
    } catch {
      throw new ClubHttpError("Invalid request origin.", 403);
    }
    const admin = await getAdminUser();
    if (!admin)
      throw new ClubHttpError(
        "Verified administrator access is required.",
        403,
      );
    if (!clubEnabled()) throw new ClubHttpError("KAPO Club is disabled.", 503);
    const body = (await readJson(request)) as Record<string, unknown>;
    if (body.action !== "adjust")
      throw new ClubHttpError("Unknown rewards action.");
    await clubStore().adjust(
      String(body.userId ?? ""),
      Number(body.delta),
      String(body.reason ?? ""),
      admin.userId,
      String(body.requestId ?? ""),
    );
    return Response.json({ ok: true });
  } catch (error) {
    return clubError(error);
  }
}
