import { jsonError, readJson } from "@/lib/commerce/http";
import { logCommerce } from "@/lib/commerce/env";
import { createCheckout } from "@/lib/commerce/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request) as { quoteId?: string; rateId?: string; discountCode?: string };
    if (!body.quoteId || !body.rateId) {
      return Response.json({ message: "Choose a shipping option before payment.", code: "rate_missing" }, { status: 400 });
    }
    const origin = new URL(request.url).origin;
    const checkout = await createCheckout({
      quoteId: body.quoteId,
      rateId: body.rateId,
      discountCode: body.discountCode,
      origin,
    });
    return Response.json(checkout);
  } catch (error) {
    logCommerce("checkout_failed", { code: error instanceof Error ? error.name : "error" });
    return jsonError(error);
  }
}
