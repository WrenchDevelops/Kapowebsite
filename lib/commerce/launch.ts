import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.ts";
import { ensureCommerceSchema } from "../../db/migrate.ts";
import { productSettings } from "../../db/schema.ts";
import { macropadLaunch, type MacropadLaunchState } from "../catalog.ts";
import { CommerceError } from "./errors.ts";

export async function getMacropadLaunch(): Promise<MacropadLaunchState> {
  try {
    await ensureCommerceSchema();
    const db = getDb();
    const rows = await db.select().from(productSettings).where(eq(productSettings.id, "macropad")).limit(1);
    const row = rows[0];
    if (!row) return { ...macropadLaunch };
    return {
      published: row.published === 1,
      forSale: row.forSale === 1,
      priceCents: row.priceCents,
      inventory: row.inventory,
    };
  } catch {
    return { ...macropadLaunch, forSale: false, priceCents: null };
  }
}

export async function saveMacropadLaunch(input: MacropadLaunchState) {
  if (input.forSale && (input.priceCents === null || input.priceCents < 1)) {
    throw new CommerceError("Set a price before turning KAPO Pad sales on.", 400, "price_required");
  }
  if (input.inventory !== null && (!Number.isInteger(input.inventory) || input.inventory < 0)) {
    throw new CommerceError("Inventory must be a whole number, or left open.", 400, "invalid_inventory");
  }
  await ensureCommerceSchema();
  const before = await getMacropadLaunch();
  const db = getDb();
  const values = {
    id: "macropad",
    published: input.published ? 1 : 0,
    forSale: input.forSale ? 1 : 0,
    priceCents: input.priceCents,
    inventory: input.inventory,
    updatedAt: new Date().toISOString(),
  };
  await db.insert(productSettings).values(values).onConflictDoUpdate({
    target: productSettings.id,
    set: {
      published: values.published,
      forSale: values.forSale,
      priceCents: values.priceCents,
      inventory: values.inventory,
      updatedAt: values.updatedAt,
    },
  });
  const after = await getMacropadLaunch();
  try {
    const { recordMacropadChange } = await import("../email/engine.ts");
    await recordMacropadChange(before, after);
  } catch (error) {
    console.log(JSON.stringify({
      source: "kapo-commerce",
      event: "announcement_failed",
      code: error instanceof Error ? error.name : "error",
    }));
  }
  return after;
}
