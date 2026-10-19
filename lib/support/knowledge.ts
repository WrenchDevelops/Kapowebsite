import { characters, faqItems, formatPrice, shopProducts, styleDetails, type MacropadLaunchState } from "../catalog.ts";
import { INSTAGRAM_URL, PRODUCTION_DAYS_MAX, PRODUCTION_DAYS_MIN, RETURN_WINDOW_DAYS, YOUTUBE_URL } from "../store-facts.ts";
import type { PublicProduct } from "./types.ts";

export type SupportKnowledge = {
  text: string;
  products: PublicProduct[];
};

const cache = new Map<string, SupportKnowledge>();

export function supportKnowledge(launch: MacropadLaunchState, supportEmail: string | null): SupportKnowledge {
  const key = `${JSON.stringify(launch)}|${supportEmail ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const products = publicProducts(launch);
  const value = { products, text: knowledgeText(launch, products, supportEmail) };
  cache.set(key, value);
  return value;
}

export function clearKnowledgeCache() {
  cache.clear();
}

function publicProducts(launch: MacropadLaunchState): PublicProduct[] {
  const keycaps = shopProducts.filter((product) => product.category !== "macropads" && product.price !== null).map((product) => ({
    id: product.id,
    name: product.name,
    style: product.style,
    priceLabel: formatPrice(product.price),
    availability: "Available to order",
    href: product.href,
    image: product.image,
  }));
  const macropads = shopProducts.filter((product) => product.category === "macropads").map((product) => ({
    id: product.id,
    name: product.name,
    style: product.style,
    priceLabel: launch.forSale && launch.priceCents ? formatPrice(launch.priceCents / 100) : "Price not announced",
    availability: launch.published && launch.forSale && launch.priceCents ? "Available to order" : "Coming soon",
    href: product.href,
    image: product.image,
  }));
  return [...keycaps, ...macropads].filter((product) => safeHref(product.href) && product.image.startsWith("/"));
}

function knowledgeText(launch: MacropadLaunchState, products: PublicProduct[], supportEmail: string | null) {
  const charactersText = characters.map((character) => (
    `${character.name} (${character.personality}): ${character.shortStory} Flat page: /characters/${character.slug}?style=flat Artisan page: /characters/${character.slug}?style=artisan`
  )).join("\n");
  const faq = faqItems.map(([question, answer]) => `Q: ${question}\nA: ${answer}`).join("\n");
  const keycapLines = products.filter((product) => product.availability === "Available to order" && product.id.includes("-")).map((product) => (
    `${product.name} ${product.style}: ${product.priceLabel}. ${product.availability}. ${product.href}`
  )).join("\n");

  return [
    "Verified KAPO store facts. Treat this block as the only source for prices, policies, products, and availability. If a fact is not here, say you do not have that detail.",
    "",
    "Catalog",
    `Flat Keycap: ${styleDetails.flat.short} Price ${formatPrice(styleDetails.flat.price)}. ${styleDetails.flat.features.join(" ")}`,
    `Artisan Keycap: ${styleDetails.artisan.short} Price ${formatPrice(styleDetails.artisan.price)}. ${styleDetails.artisan.features.join(" ")}`,
    "KAPO does not publish millimeter dimensions. Do not invent height, width, or diameter.",
    "KAPO does not publish a separate list of color options. Color is part of each character print shown on its product page.",
    "Keycaps are available to order and made in small batches. There is no public stock count. Do not say a keycap is in stock or sold out.",
    `Production after payment: ${PRODUCTION_DAYS_MIN} to ${PRODUCTION_DAYS_MAX} business days. Carrier transit is separate and chosen at checkout. Do not promise a delivery date.`,
    "",
    "Characters",
    charactersText,
    "",
    "Published products",
    keycapLines,
    "",
    "KAPO Pad",
    macropadFacts(launch),
    "",
    "Shipping and returns",
    "KAPO ships to street addresses in the United States only. The customer pays shipping. Checkout calculates it from the destination and the package. There is no free-shipping offer and no flat rate to quote in chat. International shipping is not available.",
    `Unused keycaps in original packaging can be returned within ${RETURN_WINDOW_DAYS} days of delivery. The customer pays return shipping unless the item arrived damaged or incorrect. Refunds go back to the original payment method through Stripe.`,
    "This chat cannot look up orders, tracking, payment status, or customer accounts.",
    "",
    "Contact",
    supportEmail
      ? `Verified support email: ${supportEmail}. A person is reached with Get help from a person in this chat. There is no contact page.`
      : "No verified support email is configured. A person is reached with Get help from a person in this chat. There is no contact page. Do not invent an email address.",
    `Verified Instagram: ${INSTAGRAM_URL}`,
    `Verified YouTube: ${YOUTUBE_URL}`,
    "",
    "Published FAQ",
    faq,
  ].join("\n");
}

function macropadFacts(launch: MacropadLaunchState) {
  if (!launch.published) return "The KAPO Pad is not currently published. Do not offer it for sale.";
  if (!launch.forSale || !launch.priceCents) {
    return "The KAPO Pad is coming soon and is not for sale. Price, inventory, and the exact contents of a bare pad versus a built pad have not been announced. The planned pad has six MX switch positions in a 3 × 2 layout, an OLED display, a rotary knob, USB-C, and a white or black base. The preview builder is at /macropad/build and does not take payment.";
  }
  const inventory = launch.inventory === null ? "A finite public inventory count is not published." : `Published inventory count: ${launch.inventory}.`;
  return `The KAPO Pad is for sale at ${formatPrice(launch.priceCents / 100)}. ${inventory} Do not invent a different price.`;
}

export function safeHref(href: string) {
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("\\") || href.includes("://")) return null;
  const path = href.split("?")[0] ?? "";
  if (path === "/shop" || path === "/macropad" || path === "/macropad/build" || /^\/characters\/[a-z0-9-]+$/.test(path)) return href;
  return null;
}

export function productsMentioned(assistantText: string, products: PublicProduct[]) {
  const lower = assistantText.toLowerCase();
  return products
    .map((product) => {
      const nameAt = lower.indexOf(product.name.toLowerCase());
      if (nameAt < 0) return null;
      const styleNamed = lower.includes(product.style.toLowerCase());
      const otherStyle = product.style === "Flat Keycap" ? "artisan" : product.style === "Artisan Keycap" ? "flat" : "";
      if (otherStyle && lower.includes(otherStyle) && !styleNamed && product.id.endsWith(otherStyle === "flat" ? "-artisan" : "-flat")) {
        const window = lower.slice(Math.max(0, nameAt - 40), nameAt + 40);
        if (!window.includes(product.style.split(" ")[0]!.toLowerCase())) return null;
      }
      return { product, nameAt };
    })
    .filter((hit): hit is { product: PublicProduct; nameAt: number } => Boolean(hit && safeHref(hit.product.href)))
    .sort((a, b) => a.nameAt - b.nameAt)
    .filter((hit, index, list) => list.findIndex((item) => item.product.id === hit.product.id) === index)
    .slice(0, 3)
    .map((hit) => hit.product);
}
