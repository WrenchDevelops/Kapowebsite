import { clubIdentity, clubError } from "@/lib/club/http";
import { clubStore } from "@/lib/club/server";
export async function GET(request: Request) {
  try {
    const user = await clubIdentity(request);
    const productId = new URL(request.url).searchParams.get("productId") ?? "";
    const found = await clubStore()
      .statement(
        "SELECT id FROM club_wishlist WHERE user_id=? AND product_id=?",
        user.userId,
        productId,
      )
      .first();
    return Response.json(
      { saved: Boolean(found) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return clubError(error);
  }
}
