import { characters, type CharacterSlug } from "../catalog.ts";
import { SOCIAL_LINKS } from "../store-facts.ts";
import { WORDMARK_DATA_URI, WORDMARK_HEIGHT, WORDMARK_WIDTH } from "./wordmark.ts";

export const EMAIL_FONT = "Arial, Helvetica, sans-serif";

const INK = "#111111";
const MUTED = "#5E6168";
const LINE = "#E6E6E6";
const BLUSH = "#FFF0F2";
const PAGE = "#F3F3F3";
const CARD = "#FFFFFF";

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export function emailOrigin(value?: string | null) {
  if (!value) return "https://shopkapo.com";
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") return url.origin;
  } catch {
    return "https://shopkapo.com";
  }
  return "https://shopkapo.com";
}

export function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:" && url.protocol !== "mailto:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function characterArt(origin: string, slug: CharacterSlug) {
  const character = characters.find((item) => item.slug === slug);
  const name = character?.name ?? slug;
  return {
    slug,
    name,
    src: `${origin}/products/${slug}-artisan.png`,
    alt: `${name}, a KAPO keycap character`,
  };
}

export function emailButton(label: string, href: string) {
  const url = safeHttpUrl(href);
  if (!url) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" width="100%" style="margin:0 0 10px;">
    <tr>
      <td align="left" bgcolor="#111111" style="background:${INK};border-radius:8px;">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:16px 28px;color:#ffffff;font-family:${EMAIL_FONT};font-size:16px;font-weight:700;line-height:1.2;text-decoration:none;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export function emailLink(label: string, href: string) {
  const url = safeHttpUrl(href);
  if (!url) return "";
  return `<p style="margin:0 0 8px;font-family:${EMAIL_FONT};font-size:14px;line-height:1.5;"><a href="${escapeHtml(url)}" style="color:${INK};font-weight:700;">${escapeHtml(label)}</a></p>`;
}

export function emailParagraph(text: string) {
  return `<p style="margin:0 0 14px;font-family:${EMAIL_FONT};font-size:16px;line-height:1.55;color:${INK};">${escapeHtml(text)}</p>`;
}

export function emailFacts(rows: Array<[string, string]>) {
  const body = rows.filter(([, value]) => value.trim()).map(([label, value]) => `<tr>
      <td style="padding:8px 12px 8px 0;font-family:${EMAIL_FONT};font-size:13px;line-height:1.4;color:${MUTED};vertical-align:top;">${escapeHtml(label)}</td>
      <td align="right" style="padding:8px 0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.4;color:${INK};font-weight:700;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`).join("");
  if (!body) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAFAFA" style="margin:0 0 18px;border:1px solid ${LINE};background:#FAFAFA;">
    <tr><td style="padding:6px 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table></td></tr>
  </table>`;
}

export function emailNote(title: string, text: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
    <tr>
      <td bgcolor="${BLUSH}" style="background:${BLUSH};border:1px solid #F3D5DA;padding:14px 16px;font-family:${EMAIL_FONT};">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">${escapeHtml(title)}</p>
        <p style="margin:0;font-size:15px;line-height:1.5;color:${INK};">${escapeHtml(text).replaceAll("\n", "<br />")}</p>
      </td>
    </tr>
  </table>`;
}

type ShellInput = {
  origin: string;
  preheader: string;
  eyebrow?: string;
  headline: string;
  paragraphs: string[];
  character: CharacterSlug | null;
  characterMode: "hero" | "compact" | "none";
  actionsHtml: string;
  bodyHtml: string;
  footerHtml: string;
};

export function brandedEmailHtml(input: ShellInput) {
  const origin = emailOrigin(input.origin);
  const home = safeHttpUrl(origin) || "https://shopkapo.com";
  const art = input.character && input.characterMode !== "none" ? characterArt(origin, input.character) : null;
  const preheader = escapeHtml(input.preheader.slice(0, 140));
  const eyebrow = input.eyebrow
    ? `<p style="margin:0 0 8px;font-family:${EMAIL_FONT};font-size:12px;line-height:1.4;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">${escapeHtml(input.eyebrow)}</p>`
    : "";
  const headline = `<h1 style="margin:0 0 14px;font-family:${EMAIL_FONT};font-size:32px;line-height:1.15;letter-spacing:-0.03em;font-weight:700;color:${INK};">${escapeHtml(input.headline)}</h1>`;
  const copy = input.paragraphs.map((paragraph) => emailParagraph(paragraph)).join("");
  const hero = art
    ? heroHtml(art, input.characterMode, eyebrow, headline, `${copy}${input.actionsHtml}`)
    : `${eyebrow}${headline}${copy}${input.actionsHtml}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(input.headline)}</title>
<style>
  body, table, td, p, a { font-family: ${EMAIL_FONT}; }
  .show-mobile { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
  @media only screen and (max-width: 600px) {
    .email-wrap { padding: 12px !important; }
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
    .stack { display: block !important; width: 100% !important; max-width: 100% !important; }
    .hide-mobile { display: none !important; max-height: 0 !important; overflow: hidden !important; }
    .show-mobile { display: block !important; max-height: none !important; overflow: visible !important; }
    .btn a { display: block !important; text-align: center !important; }
    h1 { font-size: 28px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};color:${INK};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE};opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE}" style="background:${PAGE};">
  <tr>
    <td class="email-wrap" align="center" style="padding:28px 12px;">
      <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${CARD};border:1px solid ${LINE};">
        <tr><td height="6" bgcolor="${BLUSH}" style="background:${BLUSH};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td class="pad" style="padding:28px 32px 8px;">
            <a href="${escapeHtml(home)}" style="text-decoration:none;color:${INK};">
              <img src="${WORDMARK_DATA_URI}" alt="KAPO" width="${WORDMARK_WIDTH}" height="${WORDMARK_HEIGHT}" style="display:block;border:0;outline:none;text-decoration:none;width:${WORDMARK_WIDTH}px;max-width:100%;height:auto;" />
            </a>
          </td>
        </tr>
        <tr>
          <td class="pad" style="padding:12px 32px 8px;font-family:${EMAIL_FONT};color:${INK};">
            ${hero}
          </td>
        </tr>
        ${input.bodyHtml ? `<tr><td class="pad" style="padding:8px 32px 12px;">${input.bodyHtml}</td></tr>` : ""}
        <tr>
          <td class="pad" style="padding:8px 32px 28px;font-family:${EMAIL_FONT};color:${MUTED};">
            <p style="margin:8px 0 16px;font-size:12px;letter-spacing:0.18em;font-weight:700;"><a href="${escapeHtml(home)}" style="color:${INK};text-decoration:none;">SHOPKAPO.COM</a></p>
            ${socialLinksHtml(origin)}
            ${input.footerHtml}
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

function heroHtml(
  art: { src: string; alt: string; name: string },
  mode: "hero" | "compact" | "none",
  eyebrow: string,
  headline: string,
  rest: string,
) {
  if (mode === "compact") {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="stack" valign="middle" style="padding:0 12px 0 0;">${eyebrow}${headline}</td>
        <td class="stack" width="112" valign="middle" align="right">${artCell(art, 96)}</td>
      </tr>
    </table>${rest}`;
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="stack" valign="top" style="padding:0 18px 0 0;">
        ${eyebrow}${headline}
        ${mobileArt(art)}
        ${rest}
      </td>
      <td class="stack hide-mobile" width="220" valign="middle" align="center">${artCell(art, 188)}</td>
    </tr>
  </table>`;
}

function mobileArt(art: { src: string; alt: string; name: string }) {
  return `<!--[if !mso]><!-->
<div class="show-mobile" aria-hidden="true" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr><td align="center">${artCell(art, 180)}</td></tr></table>
</div>
<!--<![endif]-->`;
}

function artCell(art: { src: string; alt: string; name: string }, size: number) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${BLUSH}" style="background:${BLUSH};border-radius:20px;">
    <tr>
      <td align="center" style="padding:12px;">
        <img src="${escapeHtml(art.src)}" alt="${escapeHtml(art.alt)}" width="${size}" style="display:block;border:0;outline:none;text-decoration:none;width:${size}px;max-width:100%;height:auto;" />
        <p style="margin:8px 0 0;font-family:${EMAIL_FONT};font-size:12px;line-height:1.3;letter-spacing:0.08em;text-transform:uppercase;color:${INK};font-weight:700;">${escapeHtml(art.name)}</p>
      </td>
    </tr>
  </table>`;
}

export function socialLinksHtml(origin: string) {
  const base = emailOrigin(origin);
  const cells = SOCIAL_LINKS.map((link) => {
    const href = escapeHtml(link.href);
    const src = escapeHtml(`${base}${link.icon}`);
    const label = escapeHtml(link.label);
    return `<td valign="middle" style="padding:0 10px 0 0;"><a href="${href}" style="text-decoration:none;"><img src="${src}" alt="${label}" width="32" height="32" style="display:block;border:0;outline:none;text-decoration:none;width:32px;height:32px;" /></a></td>
      <td valign="middle" style="padding:0 18px 0 0;font-family:${EMAIL_FONT};font-size:14px;line-height:32px;font-weight:700;"><a href="${href}" style="color:${INK};text-decoration:none;">${label}</a></td>`;
  }).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr>${cells}</tr></table>`;
}

export function footerBlock(lines: string[]) {
  return lines.map((line) => `<p style="margin:0 0 8px;font-family:${EMAIL_FONT};font-size:12px;line-height:1.5;color:${MUTED};">${line}</p>`).join("");
}

export function marketingFooter(unsubscribeUrl: string, mailingAddress: string, preferencesUrl?: string) {
  const unsubscribe = unsubscribeUrl.includes("RESEND_UNSUBSCRIBE_URL")
    ? `<a href="${unsubscribeUrl}" style="color:${INK};">Unsubscribe</a>`
    : linked(safeHttpUrl(unsubscribeUrl), "Unsubscribe from KAPO news");
  const preferences = preferencesUrl ? linked(safeHttpUrl(preferencesUrl), "Manage preferences") : "";
  const choice = preferences ? `${preferences} · ${unsubscribe}` : unsubscribe;
  return footerBlock([
    `You received this because you confirmed KAPO news. ${choice}.`,
    escapeHtml(mailingAddress),
  ]);
}

function linked(url: string, label: string) {
  if (!url) return label;
  return `<a href="${escapeHtml(url)}" style="color:${INK};">${label}</a>`;
}
