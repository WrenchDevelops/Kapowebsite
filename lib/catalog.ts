import { PRODUCTION_DAYS_MAX, PRODUCTION_DAYS_MIN, RETURN_WINDOW_DAYS, SUPPORT_EMAIL } from "./store-facts";

export type CharacterSlug =
  | "spore"
  | "gloop"
  | "rango"
  | "brine"
  | "bitz"
  | "orbit"
  | "kobi"
  | "rivet";

export type KeycapStyle = "flat" | "artisan";

export type Character = {
  slug: CharacterSlug;
  name: string;
  personality: string;
  shortStory: string;
  story: string;
  backstory: string;
  flatImage: string;
  artisanImage: string;
};

export const characters: Character[] = [
  {
    slug: "spore",
    name: "Spore",
    personality: "Forest Wanderer",
    shortStory: "Curious, quiet, and always looking for the scenic route.",
    story: "Spore is a tiny forest guide who believes the long way is usually the interesting way. They bring a little calm, curiosity, and woodland character to every keyboard they call home.",
    backstory: "Spore was the first KAPO character: a small forest guide made to live on a single switch. They prefer the quieter keys, the ones people reach for while thinking, and they never seem in a hurry to arrive. A little moss, a little patience, and a route that takes the scenic way around the desk.",
    flatImage: "/products/spore-flat.png",
    artisanImage: "/products/spore-artisan.png",
  },
  {
    slug: "gloop",
    name: "Gloop",
    personality: "Curious Experiment",
    shortStory: "Lovable, unpredictable, and interested in absolutely everything.",
    story: "Gloop slipped out of the lab and immediately decided the whole desk was worth exploring. Their endless curiosity tends to leave a small trail of harmless chaos behind.",
    backstory: "Gloop does not sit still for long. Every new key is another experiment, and every click is a chance to see what happens next. They are the crew member most likely to wander into a shortcut, get distracted, and somehow improve it.",
    flatImage: "/products/gloop-flat.png",
    artisanImage: "/products/gloop-artisan.png",
  },
  {
    slug: "rango",
    name: "Rango",
    personality: "Pocket Sheriff",
    shortStory: "Small hat, steady nerve, enormous sense of adventure.",
    story: "Rango keeps watch over the wildest corner of the keyboard. They may be pocket-sized, but every shortcut feels like a frontier worth protecting.",
    backstory: "Rango arrived with a small hat and a very large sense of duty. They treat the edge of the keyboard like open country and the keys beside them like a town worth looking after. Adventure, to Rango, is just a well-chosen shortcut.",
    flatImage: "/products/rango-flat.png",
    artisanImage: "/products/rango-artisan.png",
  },
  {
    slug: "brine",
    name: "Brine",
    personality: "Deep-Sea Dreamer",
    shortStory: "Patient, observant, and mapping worlds no one else can see.",
    story: "Brine charts strange currents from the quietest corner of the desk. They are happiest discovering the deep, overlooked details in everyday places.",
    backstory: "Brine moves slowly and notices everything. The glow of a screen, the pause before a keypress, the little things other characters swim past. They keep a private map of the desk and add to it one quiet observation at a time.",
    flatImage: "/products/brine-flat.png",
    artisanImage: "/products/brine-artisan.png",
  },
  {
    slug: "bitz",
    name: "Bitz",
    personality: "Arcade Regular",
    shortStory: "Fast reactions, bright ideas, and one more high score to chase.",
    story: "Bitz treats every shortcut like an arcade challenge. Quick on the keys and always ready for another round, they bring playful momentum to the crew.",
    backstory: "Bitz hears a high score in ordinary work. One more try, one cleaner combo, one faster path through the same task. They bring the bright, restless energy of a favorite arcade cabinet to whatever keyboard they land on.",
    flatImage: "/products/bitz-flat.png",
    artisanImage: "/products/bitz-artisan.png",
  },
  {
    slug: "orbit",
    name: "Orbit",
    personality: "Signal Scout",
    shortStory: "An eager explorer collecting keyboard signals from the stars.",
    story: "Orbit listens for signals in every click and keypress. Their mission is simple: map the desktop, meet the locals, and send something interesting home.",
    backstory: "Orbit showed up already curious about the crew. They collect little signals from the keyboard and file them away like star charts. Every new character is another contact, and every key is another coordinate worth keeping.",
    flatImage: "/products/orbit-flat.png",
    artisanImage: "/products/orbit-artisan.png",
  },
  {
    slug: "kobi",
    name: "Kobi",
    personality: "Garden Guardian",
    shortStory: "Calm, grounded, and never in a hurry to make a move.",
    story: "Kobi watches over small growing things with remarkable patience. They move only when the timing is right and make even a busy workspace feel more settled.",
    backstory: "Kobi is the still point in the crew. They are happy to wait, watch, and let a busy desk slow down around them. Nothing about Kobi is rushed, which is exactly why they make a keyboard feel more like a place and less like a pile of tasks.",
    flatImage: "/products/kobi-flat.png",
    artisanImage: "/products/kobi-artisan.png",
  },
  {
    slug: "rivet",
    name: "Rivet",
    personality: "Happy Tinkerer",
    shortStory: "Cheerful, practical, and already halfway through the next fix.",
    story: "Rivet sees a project in every loose part and a solution in every spare screw. They can fix almost anything before lunch—and enjoy the puzzle as much as the result.",
    backstory: "Rivet keeps the crew in working order. A wobbly idea, a missing piece, a build that needs one more pass: Rivet is already reaching for it. They like practical problems, cheerful fixes, and the satisfaction of something that clicks into place.",
    flatImage: "/products/rivet-flat.png",
    artisanImage: "/products/rivet-artisan.png",
  },
];

export const styleDetails = {
  flat: {
    label: "Flat Keycap",
    price: 6.99,
    short: "Low-profile and made for everyday use.",
    features: [
      "Low-profile keycap for everyday typing",
      "Character on the top face",
      "MX-compatible stem, switch not included",
      "Fits MX-style switches and standard key spacing",
    ],
  },
  artisan: {
    label: "Artisan Keycap",
    price: 11.99,
    short: "Fully sculpted and made to stand out.",
    features: [
      "Sculpted character, taller than the Flat cap",
      "Includes one MX-compatible switch",
      "MX-compatible stem",
      "Best as an accent, on a macropad, or on display",
    ],
  },
} satisfies Record<KeycapStyle, {
  label: string;
  price: number;
  short: string;
  features: string[];
}>;

export function getCharacter(slug: string) {
  return characters.find((character) => character.slug === slug);
}

export function characterImage(character: Character, style: KeycapStyle) {
  return style === "flat" ? character.flatImage : character.artisanImage;
}

export type ShopProduct = {
  id: string;
  name: string;
  category: "flat" | "artisan" | "macropads";
  style: string;
  price: number | null;
  image: string;
  href: string;
  comingSoon?: boolean;
};

export type MacropadLaunchState = {
  published: boolean;
  forSale: boolean;
  priceCents: number | null;
  inventory: number | null;
};

export const macropadLaunch: MacropadLaunchState = {
  published: true,
  forSale: false,
  priceCents: null,
  inventory: null,
};

export function isMacropadId(productId: string) {
  return productId.toLowerCase().includes("macropad");
}

export function macropadPurchasable(state: MacropadLaunchState) {
  return state.published && state.forSale && state.priceCents !== null && state.priceCents > 0 && state.inventory !== 0;
}

export const shopProducts: ShopProduct[] = [
  ...characters.flatMap((character) => ([
    {
      id: `${character.slug}-flat`,
      name: character.name,
      category: "flat" as const,
      style: "Flat Keycap",
      price: styleDetails.flat.price,
      image: character.flatImage,
      href: `/characters/${character.slug}?style=flat`,
    },
    {
      id: `${character.slug}-artisan`,
      name: character.name,
      category: "artisan" as const,
      style: "Artisan Keycap",
      price: styleDetails.artisan.price,
      image: character.artisanImage,
      href: `/characters/${character.slug}?style=artisan`,
    },
  ])),
  {
    id: "macropad-bare",
    name: "KAPO Pad",
    category: "macropads",
    style: "Bare",
    price: null,
    comingSoon: true,
    image: "/products/macropad-white-bare.png",
    href: "/macropad#bare-or-built",
  },
  {
    id: "macropad-custom",
    name: "KAPO Pad",
    category: "macropads",
    style: "Custom Build",
    price: null,
    comingSoon: true,
    image: "/products/macropad-white-build.png",
    href: "/macropad/build",
  },
];

export const faqItems = [
  ["Will KAPO keycaps fit my keyboard?", "Yes, on keyboards and macropads that use MX-style switches and standard key spacing. Flat caps are low-profile. Artisan caps are sculpted and need clearance beside neighboring keys."],
  ["What switches are KAPO keycaps compatible with?", "Both Flat and Artisan styles use an MX-compatible stem. Artisan includes one MX-compatible switch. Flat does not include a switch."],
  ["What is the difference between Flat and Artisan?", "Flat is a low-profile keycap for everyday typing, with the character on the top face. Artisan is a taller sculpted character and includes one MX-compatible switch."],
  ["Does an Artisan keycap include a switch?", "Yes. Each Artisan keycap includes one MX-compatible mechanical switch. A Flat keycap is the cap only."],
  ["Are KAPO keycaps hand-painted?", "No. KAPO keycaps are small-batch 3D prints. Color is part of the print, and they are not sold as hand-painted pieces."],
  ["How are they made?", "Each character is modeled, then printed in a small batch in plastic, checked, and packed."],
  ["Will every print look exactly the same?", "No. Small-batch 3D printing can leave tiny surface and color differences. Those differences are a normal part of the process."],
  ["Can I use Artisan caps for normal typing?", "They mount on an MX-compatible switch, but the sculpted height makes them better as an accent, on a macropad, or on display than as a full typing set."],
  ["What is included with the KAPO Pad?", "The KAPO Pad is coming soon and is not for sale. The planned pad has six MX switch positions in a 3 × 2 layout, an OLED display, a rotary knob, USB-C, and a white or black base. Price and the exact contents of a bare pad versus a built pad have not been announced."],
  ["Can I mix Flat and Artisan caps on the KAPO Pad?", "The preview builder lets you place Flat, Artisan, or no cap on each of the six positions. The pad itself cannot be purchased yet."],
  ["How is shipping calculated?", "KAPO ships within the United States. The customer pays shipping, calculated at checkout from the destination and the package."],
  ["Do you offer free shipping?", "No. Shipping is calculated and paid by the customer at checkout."],
  ["How long does processing take?", `Keycaps are made and packed in ${PRODUCTION_DAYS_MIN} to ${PRODUCTION_DAYS_MAX} business days after payment is confirmed. Checkout shows the window for that order. Carrier transit is separate and depends on the shipping option you choose.`],
  ["What if my order arrives damaged?", `Email ${SUPPORT_EMAIL} within ${RETURN_WINDOW_DAYS} days of delivery with the order number and photos of the item and the packaging.`],
  ["Can I return a custom KAPO Pad?", `The KAPO Pad is not for sale. When custom builds are offered, a pad made to your key selection can be returned only if it arrives damaged or does not match the build you confirmed. Unused keycaps can be returned within ${RETURN_WINDOW_DAYS} days.`],
] as const;

export function formatPrice(price: number | null) {
  return price === null ? "Price TBD" : `$${price.toFixed(2)}`;
}

export type SearchHit = {
  title: string;
  type: string;
  href: string;
  image?: string;
};

const searchIndex: SearchHit[] = [
  ...characters.map((character) => ({
    title: character.name,
    type: "Character",
    href: `/characters/${character.slug}`,
    image: character.artisanImage,
  })),
  ...shopProducts.map((product) => ({
    title: `${product.name} — ${product.style}`,
    type: "Product",
    href: product.href,
    image: product.image,
  })),
  ...faqItems.map(([question]) => ({
    title: question,
    type: "FAQ",
    href: "/faq",
  })),
];

const suggestedHrefs = [
  "/characters/spore",
  "/characters/gloop",
  "/characters/rango",
  "/characters/orbit",
  "/macropad/build",
];

export function searchSite(query: string): SearchHit[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return suggestedHrefs.flatMap((href) => searchIndex.find((hit) => hit.href === href) ?? []);
  }
  return searchIndex
    .filter((hit) => `${hit.title} ${hit.type}`.toLowerCase().includes(normalized))
    .slice(0, 6);
}
