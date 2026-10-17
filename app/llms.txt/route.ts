import { getMacropadLaunch } from "@/lib/commerce/launch";
import { llmsText } from "@/lib/site-index";
import { siteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export async function GET() {
  const [origin, launch] = await Promise.all([siteOrigin(), getMacropadLaunch()]);
  return new Response(llmsText(origin, launch), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
