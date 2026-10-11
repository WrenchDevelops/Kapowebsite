import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "KAPO — Keycaps with character",
    description:
      "Collect eight original KAPO characters as Flat or Artisan keycaps, or build your own six-key KAPO Pad.",
    icons: {
      icon: "/kapo-mascot.png",
      shortcut: "/kapo-mascot.png",
    },
    openGraph: {
      title: "KAPO — Keycaps with character",
      description:
        "Original character keycaps and a customizable six-key macropad.",
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
      title: "KAPO — Keycaps with character",
      description:
        "Original character keycaps and a customizable six-key macropad.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
