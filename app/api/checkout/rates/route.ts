import { getShopUser } from "@/app/chatgpt-auth";
import { normalizeAddress, type ShippingAddress } from "@/lib/commerce/address";
import { toE164Us } from "@/lib/commerce/sendblue";
import { logCommerce } from "@/lib/commerce/env";
import { CommerceError, jsonError, readJson } from "@/lib/commerce/http";
import { createShippingQuote } from "@/lib/commerce/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request) as {
      items?: { productId?: string; quantity?: number }[];
      address?: Record<string, string>;
      smsUpdates?: boolean;
      companyWebsite?: string;
    };
    if (body.companyWebsite) throw new CommerceError("Checkout could not be started.", 400, "invalid_request");
    const address = normalizeAddress(body.address ?? {});
    if (!address.ok) throw new CommerceError(address.message, 400, "invalid_address");
    let shippingAddress: ShippingAddress = address.address;
    if (body.smsUpdates) {
      const phone = toE164Us(shippingAddress.phone);
      if (!phone) throw new CommerceError("Enter a U.S. mobile number to get text updates.", 400, "invalid_phone");
      shippingAddress = { ...shippingAddress, phone, smsUpdates: true };
    }
    const user = await getShopUser();
    const quote = await createShippingQuote({
      items: body.items ?? [],
      address: shippingAddress,
      user,
      ip: request.headers.get("cf-connecting-ip") ?? "local",
    });
    return Response.json(quote);
  } catch (error) {
    if (!(error instanceof CommerceError)) logCommerce("quote_failed", { code: "server_error" });
    return jsonError(error);
  }
}
