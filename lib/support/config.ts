import { readEnv } from "../commerce/env.ts";
import type { SupportWidgetConfig } from "./types.ts";

function read(name: string) {
  const value = readEnv(name)?.trim();
  return value ? value : undefined;
}

function readNumber(name: string, fallback: number, min: number, max: number) {
  const raw = read(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isEmail(value: string | undefined) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 120);
}

export type SupportConfig = SupportWidgetConfig & {
  enabled: boolean;
  apiKey?: string;
  model?: string;
  siteUrl?: string;
  appName: string;
  maxHistory: number;
  maxOutputTokens: number;
  dailyRequests: number;
  ipRequests: number;
  ipWindowMs: number;
  dailyBudgetUsd: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  timeoutMs: number;
  retentionMs: number;
  extraInstructions?: string;
  visible: boolean;
};

export function supportConfig(): SupportConfig {
  const apiKey = read("OPENROUTER_API_KEY");
  const model = read("OPENROUTER_MODEL");
  const flag = read("KAPO_CHAT_ENABLED");
  const visible = flag !== "false" && flag !== "0";
  const enabled = visible && Boolean(apiKey && model);
  const verifiedEmail = read("KAPO_SUPPORT_EMAIL_VERIFIED") === "true" ? read("KAPO_SUPPORT_EMAIL") : undefined;

  return {
    enabled,
    apiKey,
    model,
    siteUrl: read("OPENROUTER_SITE_URL"),
    appName: read("OPENROUTER_APP_NAME") || "KAPO Support",
    greeting: (read("KAPO_CHAT_GREETING") || "Questions about our keycaps? 👋").slice(0, 160),
    welcome: (read("KAPO_CHAT_WELCOME") || "Hey! 👋 Welcome to KAPO. Need help with keycaps, compatibility, or an order? I'm here to help!").slice(0, 400),
    supportEmail: isEmail(verifiedEmail) ? verifiedEmail! : null,
    maxInputChars: Math.round(readNumber("KAPO_CHAT_MAX_INPUT_CHARS", 800, 200, 2000)),
    maxHistory: Math.round(readNumber("KAPO_CHAT_MAX_HISTORY", 10, 2, 16)),
    maxOutputTokens: Math.round(readNumber("KAPO_CHAT_MAX_OUTPUT_TOKENS", 140, 64, 800)),
    dailyRequests: Math.round(readNumber("KAPO_CHAT_DAILY_REQUESTS", 40, 5, 200)),
    ipRequests: Math.round(readNumber("KAPO_CHAT_IP_REQUESTS", 12, 3, 60)),
    ipWindowMs: Math.round(readNumber("KAPO_CHAT_IP_WINDOW_MS", 10 * 60 * 1000, 60_000, 60 * 60 * 1000)),
    dailyBudgetUsd: readNumber("KAPO_CHAT_DAILY_BUDGET_USD", 2, 0.05, 50),
    inputUsdPerMillion: readNumber("KAPO_CHAT_INPUT_USD_PER_MILLION", 0.091, 0, 100),
    outputUsdPerMillion: readNumber("KAPO_CHAT_OUTPUT_USD_PER_MILLION", 0.182, 0, 100),
    timeoutMs: Math.round(readNumber("KAPO_CHAT_TIMEOUT_MS", 25_000, 5_000, 45_000)),
    retentionMs: Math.round(readNumber("KAPO_CHAT_RETENTION_DAYS", 7, 1, 30)) * 24 * 60 * 60 * 1000,
    extraInstructions: read("KAPO_CHAT_INSTRUCTIONS")?.slice(0, 1200),
    visible,
  };
}

export function widgetConfig(config: SupportConfig = supportConfig()): SupportWidgetConfig | null {
  if (!config.visible) return null;
  return {
    greeting: config.greeting,
    welcome: config.welcome,
    supportEmail: config.supportEmail,
    maxInputChars: config.maxInputChars,
  };
}
