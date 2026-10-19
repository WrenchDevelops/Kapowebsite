import type { CharacterSlug } from "../catalog.ts";
import { socialPlainText } from "../store-facts.ts";
import { publicSiteUrl } from "./addresses.ts";
import { brandedEmailHtml, emailButton, emailOrigin, marketingFooter } from "./design.ts";

type MarketingCharacter = CharacterSlug;

export function renderMarketingEmail(options: {
  subject: string;
  preheader: string;
  paragraphs: string[];
  unsubscribeUrl: string;
  mailingAddress: string;
  logoUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  headline?: string;
  eyebrow?: string;
  character?: MarketingCharacter | null;
  characterMode?: "hero" | "compact" | "none";
  preferencesUrl?: string;
}) {
  const origin = emailOrigin(options.logoUrl || options.ctaUrl || "https://shopkapo.com");
  const headline = options.headline || options.subject;
  const character = options.character === undefined ? "kobi" : options.character;
  const characterMode = options.characterMode ?? (character ? "hero" : "none");
  const actions = options.ctaLabel && options.ctaUrl ? emailButton(options.ctaLabel, options.ctaUrl) : "";
  const html = brandedEmailHtml({
    origin,
    preheader: options.preheader,
    eyebrow: options.eyebrow ?? "KAPO news",
    headline,
    paragraphs: options.paragraphs,
    character,
    characterMode,
    actionsHtml: actions,
    bodyHtml: "",
    footerHtml: marketingFooter(options.unsubscribeUrl, options.mailingAddress, options.preferencesUrl),
  });
  const text = [
    options.subject,
    "",
    headline,
    "",
    ...options.paragraphs,
    options.ctaLabel && options.ctaUrl ? `${options.ctaLabel}: ${options.ctaUrl}` : "",
    "",
    options.preferencesUrl ? `Manage preferences: ${options.preferencesUrl}` : "",
    `Unsubscribe from KAPO news: ${options.unsubscribeUrl}`,
    options.mailingAddress,
    "",
    socialPlainText(),
  ].filter((line) => line !== "").join("\n");
  return { subject: options.subject, html, text };
}

export function marketingLinks(origin: string | undefined, unsubscribeToken: string) {
  const base = publicSiteUrl(origin);
  return {
    confirmUrl: (token: string) => `${base}/newsletter/confirm?token=${encodeURIComponent(token)}`,
    unsubscribeUrl: `${base}/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`,
    preferencesUrl: `${base}/newsletter/preferences?token=${encodeURIComponent(unsubscribeToken)}`,
    logoUrl: `${base}/kapo-wordmark.png`,
    shopUrl: `${base}/shop`,
  };
}

export function splitParagraphs(body: string) {
  return body.replace(/\r\n/g, "\n").split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean).slice(0, 20);
}
