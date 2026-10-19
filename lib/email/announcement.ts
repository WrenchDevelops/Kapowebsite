import { socialPlainText } from "../store-facts.ts";
import { brandedEmailHtml, emailButton, emailParagraph, escapeHtml } from "./design.ts";
import { marketingFooter } from "./design.ts";
import { absolutePublicUrl, announcementFrame, editionLabel } from "./topics.ts";

export type AnnouncementBlock = {
  imageUrl?: string;
  title: string;
  body: string;
  priceLabel?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export type AnnouncementContent = {
  subject: string;
  preheader: string;
  edition: string;
  kicker: string;
  headline: string;
  intro: string;
  blocks: AnnouncementBlock[];
};

export function renderAnnouncementEmail(content: AnnouncementContent, links: {
  unsubscribeUrl: string;
  preferencesUrl: string;
  mailingAddress: string;
  shopUrl: string;
}) {
  const blocks = content.blocks.slice(0, 8).map((block) => {
    const image = block.imageUrl
      ? `<img src="${escapeHtml(block.imageUrl)}" alt="${escapeHtml(block.title)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;margin:0 0 14px;" />`
      : "";
    const price = block.priceLabel
      ? `<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;letter-spacing:.04em;color:#111111;">${escapeHtml(block.priceLabel)}</p>`
      : "";
    const action = block.ctaLabel && block.ctaUrl ? emailButton(block.ctaLabel, block.ctaUrl) : "";
    return `<div style="margin:0 0 28px;">${image}<h2 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.2;letter-spacing:-.03em;color:#111111;">${escapeHtml(block.title)}</h2>${price}${emailParagraph(block.body)}${action}</div>`;
  }).join("");
  const html = brandedEmailHtml({
    origin: links.shopUrl,
    preheader: content.preheader,
    eyebrow: content.edition,
    headline: content.headline,
    paragraphs: [content.intro],
    character: null,
    characterMode: "none",
    actionsHtml: "",
    bodyHtml: `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#5E6168;">${escapeHtml(content.kicker)}</p>${blocks}`,
    footerHtml: marketingFooter(links.unsubscribeUrl, links.mailingAddress, links.preferencesUrl),
  });
  const text = [
    content.edition,
    content.kicker,
    content.headline,
    content.intro,
    ...content.blocks.slice(0, 8).flatMap((block) => [
      block.title,
      block.priceLabel ?? "",
      block.body,
      block.ctaLabel && block.ctaUrl ? `${block.ctaLabel}: ${block.ctaUrl}` : "",
    ]),
    links.shopUrl,
    `Manage preferences: ${links.preferencesUrl}`,
    `Unsubscribe: ${links.unsubscribeUrl}`,
    links.mailingAddress,
    socialPlainText(),
  ].filter(Boolean).join("\n\n");
  return { subject: content.subject, html, text };
}

export function readAnnouncement(value: string | null | undefined): AnnouncementContent | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<AnnouncementContent>;
    if (!parsed.headline || !parsed.subject) return null;
    const blocks = Array.isArray(parsed.blocks)
      ? parsed.blocks.filter((block) => block && typeof block.title === "string" && typeof block.body === "string")
      : [];
    return {
      subject: String(parsed.subject),
      preheader: String(parsed.preheader ?? ""),
      edition: String(parsed.edition ?? editionLabel(new Date())),
      kicker: String(parsed.kicker ?? announcementFrame("news").kicker),
      headline: String(parsed.headline),
      intro: String(parsed.intro ?? ""),
      blocks,
    };
  } catch {
    return null;
  }
}

export function singleAnnouncement(input: {
  kind: string;
  title: string;
  summary: string;
  linkUrl: string;
  imageUrl?: string;
  priceLabel?: string;
  ctaLabel?: string;
  when?: Date;
}): AnnouncementContent {
  const frame = announcementFrame(input.kind);
  const subject = input.kind === "product_restocked" && !/back/i.test(input.title)
    ? `${input.title} is back`.slice(0, 140)
    : input.title.slice(0, 140);
  return {
    subject,
    preheader: input.summary.slice(0, 180),
    edition: editionLabel(input.when ?? new Date()),
    kicker: frame.kicker,
    headline: input.kind === "digest" ? "A little something new." : input.title,
    intro: input.kind === "digest"
      ? input.summary
      : "Fresh from KAPO, ready when you are.",
    blocks: [{
      imageUrl: input.imageUrl,
      title: input.title,
      body: input.summary,
      priceLabel: input.priceLabel,
      ctaLabel: input.ctaLabel || frame.cta,
      ctaUrl: input.linkUrl,
    }],
  };
}

// Test fixture used by the email rendering suite. It is not exposed in the admin UI.
export function sampleAnnouncement(kind: "product_published" | "promotion" | "digest", origin: string): AnnouncementContent {
  const spore = absolutePublicUrl("/products/spore-artisan.png", origin) ?? `${origin}/products/spore-artisan.png`;
  const gloop = absolutePublicUrl("/products/gloop-flat.png", origin) ?? `${origin}/products/gloop-flat.png`;
  if (kind === "promotion") {
    return singleAnnouncement({ kind, title: "A KAPO bundle, for a little while.", summary: "Pair a Flat keycap with an Artisan and save on the set.", linkUrl: `${origin}/shop`, imageUrl: gloop, priceLabel: "Use the code in the shop" });
  }
  if (kind === "digest") {
    const content = singleAnnouncement({ kind, title: "This week at KAPO", summary: "Fresh characters, creative ideas, and a peek at what's happening behind the scenes.", linkUrl: `${origin}/shop`, imageUrl: spore });
    content.blocks.push({ imageUrl: gloop, title: "Behind the print.", body: "A look at how the latest character came off the printer.", ctaLabel: "Watch on YouTube", ctaUrl: `${origin}/about` });
    return content;
  }
  return singleAnnouncement({ kind, title: "Meet Spore.", summary: "A tiny woodland friend ready for your keyboard.", linkUrl: `${origin}/characters/spore?style=artisan`, imageUrl: spore, priceLabel: "$11.99" });
}

