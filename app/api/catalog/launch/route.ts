import { getMacropadLaunch } from "@/lib/commerce/launch";

export const dynamic = "force-dynamic";

export async function GET() {
  const macropad = await getMacropadLaunch();
  return Response.json({ macropad });
}
