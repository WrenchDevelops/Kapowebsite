import type { MetadataRoute } from "next";
import { getMacropadLaunch } from "@/lib/commerce/launch";
import { publicPages } from "@/lib/site-index";
import { siteOrigin } from "@/lib/site-origin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const launch = await getMacropadLaunch();
  return publicPages(launch)
    .filter((page) => page.path !== "/llms.txt")
    .map((page) => ({
      url: `${origin}${page.path}`,
      changeFrequency: page.path.startsWith("/characters/") ? "weekly" : "weekly",
      priority: page.path === "/" ? 1 : page.path.startsWith("/characters/") || page.path === "/shop" ? 0.8 : 0.6,
    }));
}
