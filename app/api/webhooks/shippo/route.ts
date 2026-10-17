import { commerceEnv, logCommerce } from "@/lib/commerce/env";
import { jsonError } from "@/lib/commerce/http";
import { safeEqual, shippoIpAllowed, verifyTimestampedHmac } from "@/lib/commerce/signatures";
import { applyShippoWebhook } from "@/lib/commerce/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.text();
  const settings = commerceEnv();
  if (!settings.shippoWebhookSecret && !settings.shippoWebhookToken) {
    return Response.json({ message: "Shippo webhook verification is not configured." }, { status: 503 });
  }
  const url = new URL(request.url);
  if (settings.shippoWebhookToken && !safeEqual(url.searchParams.get("token") ?? "", settings.shippoWebhookToken)) {
    return Response.json({ message: "Invalid Shippo webhook token." }, { status: 401 });
  }
  if (settings.shippoWebhookSecret) {
    const header = request.headers.get("shippo-auth-signature") ?? request.headers.get("x-shippo-auth-signature");
    const valid = await verifyTimestampedHmac({
      header,
      payload,
      secret: settings.shippoWebhookSecret,
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    if (!valid) return Response.json({ message: "Invalid Shippo webhook signature." }, { status: 401 });
  }
  if (!shippoIpAllowed(request.headers.get("cf-connecting-ip"), settings.enforceShippoIps)) {
    return Response.json({ message: "Shippo webhook origin was rejected." }, { status: 401 });
  }
  try {
    const body = JSON.parse(payload) as { event?: string; data?: Record<string, unknown> };
    const result = await applyShippoWebhook(body);
    return Response.json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    logCommerce("shippo_webhook_failed", { code: "processing_failed" });
    return jsonError(error);
  }
}
