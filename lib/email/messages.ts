import type { CharacterSlug } from "../catalog.ts";
import { socialPlainText, SUPPORT_EMAIL } from "../store-facts.ts";
import {
  brandedEmailHtml,
  characterArt,
  emailButton,
  emailFacts,
  emailNote,
  emailOrigin,
  escapeHtml,
  footerBlock,
  marketingFooter,
} from "./design.ts";

const FONT = "Arial, Helvetica, sans-serif";

export function renderSupportAck(options: { origin: string; email: string; message: string; reference: string }) {
  const subject = "We got your message";
  const paragraphs = [
    `KAPO received your message and will reply to ${options.email}.`,
    "A person on the KAPO team typically replies within 24–48 hours.",
  ];
  const html = brandedEmailHtml({
    origin: options.origin,
    preheader: `Reference ${options.reference}. KAPO typically replies within 24–48 hours.`,
    eyebrow: `Reference ${options.reference}`,
    headline: "We got your message",
    paragraphs,
    character: "rivet",
    characterMode: "compact",
    actionsHtml: emailButton("Contact KAPO", `mailto:${SUPPORT_EMAIL}`),
    bodyHtml: `${emailNote("Your message", options.message.slice(0, 2000))}`,
    footerHtml: footerBlock([
      `Questions before we reply: <a href="mailto:${SUPPORT_EMAIL}" style="color:#111111;">${SUPPORT_EMAIL}</a>.`,
      "This message confirms a support request. It is not a newsletter.",
    ]),
  });
  const text = [
    subject,
    "",
    `Reference ${options.reference}`,
    ...paragraphs,
    "",
    options.message,
    "",
    SUPPORT_EMAIL,
    "",
    socialPlainText(),
  ].join("\n");
  return { subject, html, text };
}

export function renderSupportTeam(options: {
  origin: string;
  email: string;
  message: string;
  reference: string;
  submittedAt: string;
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const subject = `KAPO support request ${options.reference}`;
  const lines = options.transcript.slice(-12).map((item) => {
    const who = item.role === "user" ? "Customer" : "Kapo";
    return `<p style="margin:0 0 12px;font-family:${FONT};font-size:14px;line-height:1.5;color:#111111;"><strong>${who}:</strong> ${escapeHtml(item.content).replaceAll("\n", "<br />")}</p>`;
  }).join("");
  const html = brandedEmailHtml({
    origin: options.origin,
    preheader: `${options.email} · ${options.reference}`,
    eyebrow: options.reference,
    headline: "New support request",
    paragraphs: ["Reply to the customer from this thread. The address below is the one they asked KAPO to use."],
    character: null,
    characterMode: "none",
    actionsHtml: emailButton("Reply to customer", `mailto:${options.email}`),
    bodyHtml: `${emailFacts([["Customer", options.email], ["Submitted", options.submittedAt]])}
      ${emailNote("Message", options.message.slice(0, 4000))}
      <p style="margin:0 0 8px;font-family:${FONT};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#5E6168;">Recent chat</p>
      ${lines || `<p style="margin:0;font-family:${FONT};font-size:14px;color:#111111;">No chat messages yet.</p>`}`,
    footerHtml: footerBlock(["Internal KAPO support mail."]),
  });
  const text = [
    subject,
    `Customer email: ${options.email}`,
    `Submitted: ${options.submittedAt}`,
    "",
    options.message,
    "",
    "Recent chat",
    options.transcript.slice(-12).map((item) => `${item.role === "user" ? "Customer" : "Kapo"}: ${item.content}`).join("\n\n") || "No chat messages yet.",
    "",
    socialPlainText(),
  ].join("\n");
  return { subject, html, text };
}

export function renderSignInEmail(options: { origin: string; code: string; signInUrl?: string; expiresMinutes: number }) {
  const subject = "Your KAPO sign-in code";
  const minutes = Math.max(1, Math.round(options.expiresMinutes));
  const code = options.code.trim().slice(0, 12);
  const paragraphs = [`This code expires in ${minutes} minutes. If you did not try to sign in, you can ignore this email.`];
  const codeHtml = `<p style="margin:0 0 16px;padding:18px 12px;background:#FFF0F2;border:1px solid #F3D5DA;font-family:${FONT};font-size:36px;line-height:1;letter-spacing:0.28em;font-weight:700;text-align:center;color:#111111;">${escapeHtml(code)}</p>`;
  const button = options.signInUrl ? emailButton("Sign in to KAPO", options.signInUrl) : "";
  const html = brandedEmailHtml({
    origin: options.origin,
    preheader: `Your code expires in ${minutes} minutes.`,
    eyebrow: "Sign in",
    headline: "Your KAPO sign-in code",
    paragraphs,
    character: "bitz",
    characterMode: "compact",
    actionsHtml: `${codeHtml}${button}`,
    bodyHtml: "",
    footerHtml: footerBlock([
      "KAPO will never ask you to forward this code.",
      `Questions: <a href="mailto:${SUPPORT_EMAIL}" style="color:#111111;">${SUPPORT_EMAIL}</a>`,
    ]),
  });
  const text = [
    subject,
    "",
    code,
    "",
    ...paragraphs,
    options.signInUrl ? `Sign in to KAPO: ${options.signInUrl}` : "",
    "",
    SUPPORT_EMAIL,
    "",
    socialPlainText(),
  ].filter((line) => line !== "").join("\n");
  return { subject, html, text };
}

export function renderBackInStockEmail(options: {
  origin: string;
  character: CharacterSlug;
  productName: string;
  productUrl: string;
  unsubscribeUrl: string;
  mailingAddress: string;
  preferencesUrl?: string;
}) {
  const art = characterArt(emailOrigin(options.origin), options.character);
  const subject = `${art.name} is back at KAPO`;
  const paragraphs = [
    `${options.productName} is available again.`,
    "KAPO makes these in small batches, so this note only goes to people who asked to hear about shop news.",
  ];
  const html = brandedEmailHtml({
    origin: options.origin,
    preheader: `${options.productName} is available again.`,
    eyebrow: "Back in stock",
    headline: `${art.name} is back`,
    paragraphs,
    character: options.character,
    characterMode: "hero",
    actionsHtml: emailButton("Shop this character", options.productUrl),
    bodyHtml: "",
    footerHtml: marketingFooter(options.unsubscribeUrl, options.mailingAddress, options.preferencesUrl),
  });
  const text = [
    subject,
    "",
    ...paragraphs,
    `Shop this character: ${options.productUrl}`,
    "",
    options.preferencesUrl ? `Manage preferences: ${options.preferencesUrl}` : "",
    `Unsubscribe from KAPO news: ${options.unsubscribeUrl}`,
    options.mailingAddress,
    "",
    socialPlainText(),
  ].filter((line) => line !== "").join("\n");
  return { subject, html, text };
}

export function renderLaunchEmail(options: {
  origin: string;
  character: CharacterSlug;
  headline: string;
  paragraphs: string[];
  productUrl: string;
  unsubscribeUrl: string;
  mailingAddress: string;
  preferencesUrl?: string;
}) {
  const art = characterArt(emailOrigin(options.origin), options.character);
  const subject = `Meet ${art.name}`;
  const featured = options.character === "kobi"
    ? ""
    : `<img src="${escapeHtml(art.src)}" alt="${escapeHtml(art.alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;margin:0 auto;" />`;
  const html = brandedEmailHtml({
    origin: options.origin,
    preheader: options.paragraphs[0] ?? subject,
    eyebrow: "New character",
    headline: options.headline,
    paragraphs: options.paragraphs,
    character: "kobi",
    characterMode: "hero",
    actionsHtml: emailButton("Shop collection", options.productUrl),
    bodyHtml: featured,
    footerHtml: marketingFooter(options.unsubscribeUrl, options.mailingAddress, options.preferencesUrl),
  });
  const text = [
    subject,
    "",
    options.headline,
    "",
    ...options.paragraphs,
    `Shop collection: ${options.productUrl}`,
    "",
    options.preferencesUrl ? `Manage preferences: ${options.preferencesUrl}` : "",
    `Unsubscribe from KAPO news: ${options.unsubscribeUrl}`,
    options.mailingAddress,
    "",
    socialPlainText(),
  ].join("\n");
  return { subject, html, text };
}
