import { commerceEnv } from "@/lib/commerce/env";
import { liveModeBlocked } from "@/lib/commerce/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = commerceEnv();
  const liveBlock = settings.stripeSecretKey
    ? liveModeBlocked(settings.stripeSecretKey, "stripe", settings.allowLivePayments)
    : "Stripe is not configured yet.";
  const publishableLive = settings.stripePublishableKey.startsWith("pk_live_") && !settings.allowLivePayments;
  if (!settings.stripePublishableKey || liveBlock || publishableLive) {
    return Response.json({
      publishableKey: null,
      taxEnabled: settings.taxEnabled,
      currency: settings.currency,
      message: liveBlock || (publishableLive ? "Live Stripe charges are blocked until KAPO_ALLOW_LIVE_PAYMENTS=true." : "Add STRIPE_PUBLISHABLE_KEY to open checkout."),
    });
  }
  return Response.json({
    publishableKey: settings.stripePublishableKey,
    taxEnabled: settings.taxEnabled,
    currency: settings.currency,
    message: null,
  });
}
