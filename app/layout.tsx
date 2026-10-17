import type { Metadata, Viewport } from "next";
import { CommerceProvider } from "@/components/CommerceProvider";
import { RevealOnView } from "@/components/RevealOnView";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMacropadLaunch } from "@/lib/commerce/launch";
import { siteJsonLd } from "@/lib/site-index";
import { siteOrigin } from "@/lib/site-origin";
import "./globals.css";
import "./storefront.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export async function generateMetadata(): Promise<Metadata> {
  const origin = await siteOrigin();

  return {
    metadataBase: new URL(origin),
    title: {
      default: "KAPO — Keycaps with character",
      template: "%s · KAPO",
    },
    description:
      "Eight original KAPO characters as Flat or Artisan keycaps for MX-style switches. The KAPO Pad is an upcoming six-key macropad and is not for sale yet.",
    alternates: {
      canonical: "/",
      types: {
        "text/plain": `${origin}/llms.txt`,
      },
    },
    icons: {
      icon: "/kapo-mascot.png",
      shortcut: "/kapo-mascot.png",
    },
    openGraph: {
      title: {
        default: "KAPO — Keycaps with character",
        template: "%s · KAPO",
      },
      description:
        "Eight original character keycaps. The KAPO Pad is coming soon and is not for sale yet.",
      url: origin,
      siteName: "KAPO",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1734,
          height: 907,
          alt: "KAPO keycaps with character on a six-key macropad",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: {
        default: "KAPO — Keycaps with character",
        template: "%s · KAPO",
      },
      description:
        "Eight original character keycaps. The KAPO Pad is coming soon and is not for sale yet.",
      images: [`${origin}/og.png`],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const origin = await siteOrigin();
  const launch = await getMacropadLaunch();
  const jsonLd = JSON.stringify(siteJsonLd(origin, launch)).replace(/</g, "\\u003c");
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <CommerceProvider>
          <RevealOnView />
          <a className="skip-link" href="#main-content">Skip to content</a>
          <SiteHeader />
          {children}
          <SiteFooter />
        </CommerceProvider>
      </body>
    </html>
  );
}
