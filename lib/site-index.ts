import { characters, faqItems, formatPrice, macropadPurchasable, styleDetails, type MacropadLaunchState } from "./catalog";
import { PRODUCTION_DAYS_MAX, PRODUCTION_DAYS_MIN, RETURN_WINDOW_DAYS, SUPPORT_EMAIL } from "./store-facts";

export type PublicPage = {
  path: string;
  title: string;
  summary: string;
};

export function publicPages(launch: MacropadLaunchState): PublicPage[] {
  const pad = macropadPurchasable(launch) && launch.priceCents !== null
    ? `The KAPO Pad is for sale at ${formatPrice(launch.priceCents / 100)}.`
    : "The KAPO Pad is coming soon. Price TBD. It is visible on the site and cannot be purchased.";
  return [
    { path: "/", title: "Home", summary: "KAPO homepage. Eight original character keycaps, Flat and Artisan, are the focus. The KAPO Pad preview is further down and is not for sale." },
    { path: "/shop", title: "Shop", summary: `Every keycap for sale and the KAPO Pad listing. Flat keycaps are ${formatPrice(styleDetails.flat.price)}. Artisan keycaps are ${formatPrice(styleDetails.artisan.price)}.` },
    { path: "/characters", title: "Characters", summary: "Index of all eight KAPO characters, with a link to each character page." },
    ...characters.map((character) => ({
      path: `/characters/${character.slug}`,
      title: character.name,
      summary: `${character.personality}. ${character.story} Flat ${formatPrice(styleDetails.flat.price)}. Artisan ${formatPrice(styleDetails.artisan.price)}.`,
    })),
    { path: "/macropad", title: "KAPO Pad", summary: `Six-key macropad with an OLED display, rotary knob, USB-C, and a white or black base. ${pad}` },
    { path: "/macropad/build", title: "KAPO Pad preview", summary: `Preview a six-key layout. ${pad}` },
    { path: "/about", title: "About", summary: "KAPO is a small character-driven keycap project. Characters are modeled, printed in small batches, checked, and packed." },
    { path: "/faq", title: "FAQ", summary: "Fit, switches, Flat versus Artisan, making, shipping, and the KAPO Pad." },
    { path: "/contact", title: "Contact", summary: `Support email ${SUPPORT_EMAIL} and a contact form.` },
    { path: "/shipping-returns", title: "Shipping and returns", summary: `United States shipping is paid by the customer and calculated at checkout. Keycaps are made in ${PRODUCTION_DAYS_MIN} to ${PRODUCTION_DAYS_MAX} business days. Unused keycaps can be returned within ${RETURN_WINDOW_DAYS} days of delivery.` },
    { path: "/privacy", title: "Privacy", summary: "KAPO collects checkout and contact details to fulfill orders. Stripe processes cards, Shippo ships parcels, and Resend sends order email. KAPO does not sell personal information." },
    { path: "/terms", title: "Terms", summary: "Keycap orders are accepted when Stripe confirms payment. The KAPO Pad is not for sale. Shipping, production time, and returns follow the published policies." },
    { path: "/llms.txt", title: "Plain-text site guide", summary: "The full public site in plain text, written for assistants that start from the homepage link." },
  ];
}

export function llmsText(origin: string, launch: MacropadLaunchState) {
  const pages = publicPages(launch);
  const lines = [
    "# KAPO",
    "",
    "> Original character keycaps for MX-compatible switches. Flat keycaps are for everyday use. Artisan keycaps are sculpted collectibles and include one switch. The KAPO Pad is a six-key macropad.",
    "",
    "This file is the plain-text map of the public site. Follow the links to read each page. Private areas such as account, checkout, cart, and admin are omitted.",
    "",
    `Flat keycap price: ${formatPrice(styleDetails.flat.price)}.`,
    `Artisan keycap price: ${formatPrice(styleDetails.artisan.price)}.`,
    macropadPurchasable(launch) && launch.priceCents !== null
      ? `KAPO Pad price: ${formatPrice(launch.priceCents / 100)}. Sales are on.`
      : "KAPO Pad: Coming soon. Price TBD. Not for sale. Do not describe it as available to buy or as a preorder.",
    "Shipping: United States only. The customer pays shipping, calculated at checkout. There is no free-shipping offer.",
    `Production: ${PRODUCTION_DAYS_MIN} to ${PRODUCTION_DAYS_MAX} business days after payment, shown again at checkout. Carrier transit is extra.`,
    `Returns: unused keycaps in original packaging within ${RETURN_WINDOW_DAYS} days of delivery. Email ${SUPPORT_EMAIL}.`,
    "",
    "## Pages",
    "",
    ...pages.filter((page) => page.path !== "/llms.txt").map((page) => `- [${page.title}](${origin}${page.path}): ${page.summary}`),
    "",
    "## Characters",
    "",
    ...characters.map((character) => [
      `### ${character.name}`,
      "",
      `${character.personality}. ${character.shortStory}`,
      "",
      character.story,
      "",
      character.backstory,
      "",
      `Page: ${origin}/characters/${character.slug}`,
      "",
    ].join("\n")),
    "## FAQ",
    "",
    ...faqItems.map(([question, answer]) => `### ${question}\n\n${answer}\n`),
    "## How to keep reading",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    `Robots: ${origin}/robots.txt`,
    "",
  ];
  return lines.join("\n");
}

export function siteJsonLd(origin: string, launch: MacropadLaunchState) {
  const padForSale = macropadPurchasable(launch) && launch.priceCents !== null;
  const products = [
    ...characters.flatMap((character) => (["flat", "artisan"] as const).map((style) => ({
      "@type": "Product",
      name: `${character.name} ${styleDetails[style].label}`,
      description: styleDetails[style].short,
      image: `${origin}${style === "flat" ? character.flatImage : character.artisanImage}`,
      brand: { "@type": "Brand", name: "KAPO" },
      url: `${origin}/characters/${character.slug}`,
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        price: styleDetails[style].price.toFixed(2),
        availability: "https://schema.org/InStock",
        url: `${origin}/characters/${character.slug}`,
      },
    }))),
    {
      "@type": "Product",
      name: "KAPO Pad",
      description: padForSale
        ? "Six-key mechanical macropad."
        : "Six-key mechanical macropad. Coming soon. Price has not been announced. Not for sale.",
      image: `${origin}/products/macropad-white-build.png`,
      brand: { "@type": "Brand", name: "KAPO" },
      url: `${origin}/macropad`,
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        ...(padForSale ? { price: (launch.priceCents! / 100).toFixed(2) } : {}),
        availability: padForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: `${origin}/macropad`,
      },
    },
  ];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "KAPO",
        url: origin,
        description: "Original character keycaps for MX-style switches. The KAPO Pad is coming soon and is not for sale.",
      },
      {
        "@type": "ItemList",
        name: "KAPO products",
        itemListElement: products.map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: product.url,
          item: product,
        })),
      },
    ],
  };
}
