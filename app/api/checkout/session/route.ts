import { getShopUser } from "@/app/chatgpt-auth";
import { ClubRuleError } from "@/lib/club/policy";
import { checkoutReturnOrigin } from "@/lib/commerce/checkout-session";
import { commerceEnv, logCommerce } from "@/lib/commerce/env";
import { jsonError, readJson } from "@/lib/commerce/http";
import { createCheckout } from "@/lib/commerce/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request) as { quoteId?: string; rateId?: string; discountCode?: string; redemptionId?: string };
    if (!body.quoteId || !body.rateId) {
      return Response.json({ message: "Choose a shipping option before payment.", code: "rate_missing" }, { status: 400 });
    }
    const settings = commerceEnv();
    const origin = checkoutReturnOrigin(new URL(request.url).origin, settings.publicSiteUrl);
    const checkout = await createCheckout({
      quoteId: body.quoteId,
      rateId: body.rateId,
      discountCode: body.discountCode,
      redemptionId: body.redemptionId,
      user: await getShopUser(),
      origin,
    });
    return Response.json(checkout);
  } catch (error) {
    if (error instanceof ClubRuleError) return Response.json({ message: error.message, code: "reward_or_checkout_unavailable" }, { status: 409 });
    logCommerce("checkout_failed", { code: error instanceof Error ? error.name : "error" });
    return jsonError(error);
  }
}
