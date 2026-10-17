import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-origin";

const hidden = ["/admin", "/account", "/api/", "/checkout", "/cart", "/order-confirmation"];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  const allowPublic = { allow: "/", disallow: hidden };
  return {
    rules: [
      { userAgent: "*", ...allowPublic },
      { userAgent: "GPTBot", ...allowPublic },
      { userAgent: "ChatGPT-User", ...allowPublic },
      { userAgent: "OAI-SearchBot", ...allowPublic },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
