import { getAdminUser } from "@/app/admin-auth";
import { saveMacropadLaunch } from "@/lib/commerce/launch";
import { CommerceError } from "@/lib/commerce/errors";
import { jsonError, readJson } from "@/lib/commerce/http";
import { moneyStringToCents } from "@/lib/commerce/money";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ message: "Admin access is required." }, { status: 403 });
  try {
    const body = await readJson(request) as { published?: boolean; forSale?: boolean; price?: string; inventory?: string };
    const price = (body.price ?? "").trim();
    const inventoryText = (body.inventory ?? "").trim();
    const priceCents = price ? moneyStringToCents(price) : null;
    if (price && priceCents === null) throw new CommerceError("Enter a price like 49.00, or leave it blank.", 400, "invalid_price");
    const inventory = inventoryText ? Number(inventoryText) : null;
    const launch = await saveMacropadLaunch({
      published: body.published === true,
      forSale: body.forSale === true,
      priceCents,
      inventory,
    });
    return Response.json({ macropad: launch });
  } catch (error) {
    return jsonError(error);
  }
}
