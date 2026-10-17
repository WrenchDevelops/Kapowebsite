import type { Metadata } from "next";

export function pageMetadata(title: string, description: string, path: string, index = true): Metadata {
  const fullTitle = `${title} · KAPO`;
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title: fullTitle, description, url: path },
    twitter: { title: fullTitle, description },
  };
}
