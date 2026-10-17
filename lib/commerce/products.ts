import { characters, isMacropadId, macropadLaunch, macropadPurchasable, styleDetails, type KeycapStyle, type MacropadLaunchState } from "../catalog.ts";
import { priceToCents } from "./money.ts";

export const PRODUCT_WEIGHT_GRAMS: Record<KeycapStyle, number> = {
  flat: 12,
  artisan: 28,
};

export const TAX_CODE_TANGIBLE_GOODS = "txcd_99999999";
export const MAX_QUANTITY = 20;

export type PricedLine = {
  productId: string;
  name: string;
  style: string;
  image: string;
  unitPriceCents: number;
  quantity: number;
  weightGrams: number;
  lineTotalCents: number;
};

type CatalogProduct = {
  name: string;
  style: string;
  image: string;
  unitPriceCents: number;
  weightGrams: number;
};

function stylePriceCents(style: KeycapStyle) {
  const cents = priceToCents(styleDetails[style].price);
  if (cents === null) throw new Error(`Invalid ${style} price`);
  return cents;
}

const products = new Map<string, CatalogProduct>(
  characters.flatMap((character) => ([
    [`${character.slug}-flat`, {
      name: `${character.name} — Flat Keycap`,
      style: styleDetails.flat.label,
      image: character.flatImage,
      unitPriceCents: stylePriceCents("flat"),
      weightGrams: PRODUCT_WEIGHT_GRAMS.flat,
    }],
    [`${character.slug}-artisan`, {
      name: `${character.name} — Artisan Keycap`,
      style: styleDetails.artisan.label,
      image: character.artisanImage,
      unitPriceCents: stylePriceCents("artisan"),
      weightGrams: PRODUCT_WEIGHT_GRAMS.artisan,
    }],
  ])),
);

const MACROPAD_WEIGHT_GRAMS = 220;

export function priceCart(items: { productId?: string; quantity?: number }[], gate: MacropadLaunchState = macropadLaunch) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false as const, message: "Your cart is empty." };
  }
  if (items.length > 30) {
    return { ok: false as const, message: "This cart has too many lines to check out." };
  }

  const lines: PricedLine[] = [];
  for (const item of items) {
    const productId = String(item.productId ?? "");
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { ok: false as const, message: `Each item quantity must be from 1 to ${MAX_QUANTITY}.` };
    }
    if (isMacropadId(productId)) {
      if (!macropadPurchasable(gate) || gate.priceCents === null) {
        return { ok: false as const, message: "The KAPO Pad is coming soon and is not for sale." };
      }
      const custom = productId.toLowerCase().includes("custom");
      lines.push({
        productId: custom ? "macropad-custom" : "macropad-bare",
        name: "KAPO Pad",
        style: custom ? "Custom build" : "Bare",
        image: custom ? "/products/macropad-white-build.png" : "/products/macropad-white-bare.png",
        unitPriceCents: gate.priceCents,
        quantity,
        weightGrams: MACROPAD_WEIGHT_GRAMS,
        lineTotalCents: gate.priceCents * quantity,
      });
      continue;
    }
    const product = products.get(productId);
    if (!product) return { ok: false as const, message: "One or more cart items are not available." };
    lines.push({
      ...product,
      productId,
      quantity,
      lineTotalCents: product.unitPriceCents * quantity,
    });
  }

  const macropadQuantity = lines.filter((line) => isMacropadId(line.productId)).reduce((total, line) => total + line.quantity, 0);
  if (gate.inventory !== null && macropadQuantity > gate.inventory) {
    return { ok: false as const, message: "The KAPO Pad is not available in that quantity." };
  }

  const merged = new Map<string, PricedLine>();
  for (const line of lines) {
    const existing = merged.get(line.productId);
    if (!existing) {
      merged.set(line.productId, { ...line });
      continue;
    }
    const quantity = existing.quantity + line.quantity;
    if (quantity > MAX_QUANTITY) {
      return { ok: false as const, message: `Each item quantity must be from 1 to ${MAX_QUANTITY}.` };
    }
    existing.quantity = quantity;
    existing.lineTotalCents = existing.unitPriceCents * quantity;
  }

  return { ok: true as const, lines: [...merged.values()] };
}

export function merchandiseSubtotal(lines: PricedLine[]) {
  return lines.reduce((total, line) => total + line.lineTotalCents, 0);
}

export async function cartHash(lines: PricedLine[]) {
  const payload = lines
    .map((line) => `${line.productId}:${line.quantity}`)
    .sort()
    .join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
