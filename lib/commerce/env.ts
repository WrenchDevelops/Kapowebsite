import { env } from "../workers-env.ts";

export function readEnv(name: string) {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  const binding = (env as unknown as Record<string, unknown>)[name];
  return typeof binding === "string" ? binding : undefined;
}

export function envFlag(name: string) {
  return readEnv(name) === "true";
}

export function commerceEnv() {
  return {
    stripeSecretKey: readEnv("STRIPE_SECRET_KEY") ?? "",
    stripePublishableKey: readEnv("STRIPE_PUBLISHABLE_KEY") ?? "",
    stripeWebhookSecret: readEnv("STRIPE_WEBHOOK_SECRET") ?? "",
    shippoToken: readEnv("SHIPPO_API_TOKEN") ?? "",
    shippoWebhookSecret: readEnv("SHIPPO_WEBHOOK_SECRET") ?? "",
    shippoWebhookToken: readEnv("SHIPPO_WEBHOOK_TOKEN") ?? "",
    originJson: readEnv("KAPO_SHIPPING_ORIGIN"),
    currency: (readEnv("KAPO_DEFAULT_CURRENCY") ?? "usd").toLowerCase(),
    handlingFeeCents: integerEnv("KAPO_SHIPPING_HANDLING_FEE_CENTS", 0),
    quoteTtlSeconds: integerEnv("KAPO_SHIPPING_QUOTE_TTL_SECONDS", 1800),
    productionDaysMin: integerEnv("KAPO_PRODUCTION_DAYS_MIN", 5),
    productionDaysMax: integerEnv("KAPO_PRODUCTION_DAYS_MAX", 10),
    discountCodes: readEnv("KAPO_DISCOUNT_CODES"),
    shipTo: readEnv("KAPO_SHIP_TO_COUNTRIES"),
    adminEmails: readEnv("KAPO_ADMIN_EMAILS"),
    taxEnabled: envFlag("STRIPE_TAX_ENABLED"),
    allowLivePayments: envFlag("KAPO_ALLOW_LIVE_PAYMENTS"),
    allowLiveLabels: envFlag("KAPO_ALLOW_LIVE_LABELS"),
    enforceShippoIps: envFlag("KAPO_SHIPPO_ENFORCE_IP_ALLOWLIST"),
    resendKey: readEnv("RESEND_API_KEY") ?? "",
    emailFrom: readEnv("KAPO_EMAIL_FROM") ?? "",
    sendblueKey: readEnv("SENDBLUE_API_KEY") ?? "",
    sendblueSecret: readEnv("SENDBLUE_API_SECRET") ?? "",
    sendblueFrom: readEnv("SENDBLUE_FROM_NUMBER") ?? "",
    adminDevBypass: envFlag("KAPO_ADMIN_DEV_BYPASS") && process.env.NODE_ENV !== "production",
    autoMigrate: process.env.NODE_ENV !== "production" || envFlag("KAPO_AUTO_MIGRATE"),
  };
}

function integerEnv(name: string, fallback: number) {
  const parsed = Number(readEnv(name));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

const BLOCKED_LOG_KEY = /email|address|token|secret|authorization|phone|street|postal|name/i;

export function logCommerce(event: string, fields: Record<string, string | number | boolean | null>) {
  const safe: Record<string, string | number | boolean | null> = {};
  const removed: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (BLOCKED_LOG_KEY.test(key)) removed.push(key);
    else safe[key] = value;
  }
  console.log(JSON.stringify({ source: "kapo-commerce", event, ...safe, redacted: removed }));
}
