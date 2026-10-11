import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAPO",
  description: "Meet the world of Kapo and its characters.",
  icons: {
    icon: "/kapo-mascot.png",
    shortcut: "/kapo-mascot.png",
  },
};

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
