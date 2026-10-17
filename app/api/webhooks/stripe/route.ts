import Stripe from "stripe";
import { commerceEnv, logCommerce } from "@/lib/commerce/env";
import { jsonError } from "@/lib/commerce/http";
import { applyStripeWebhook } from "@/lib/commerce/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const settings = commerceEnv();
  if (!settings.stripeSecretKey || !settings.stripeWebhookSecret || !signature) {
    return Response.json({ message: "Stripe webhooks are not configured." }, { status: 503 });
  }
  const stripe = new Stripe(settings.stripeSecretKey, { httpClient: Stripe.createFetchHttpClient() });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, settings.stripeWebhookSecret);
  } catch {
    return Response.json({ message: "Invalid Stripe signature." }, { status: 400 });
  }
  try {
    const result = await applyStripeWebhook(event);
    return Response.json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    logCommerce("stripe_webhook_failed", { code: event.type });
    return jsonError(error);
  }
}
