import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CharacterProduct } from "@/components/CharacterProduct";
import { characters, formatPrice, getCharacter, styleDetails } from "@/lib/catalog";
import { pageMetadata } from "@/lib/page-meta";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const character = getCharacter(slug);
  if (!character) return {};
  return pageMetadata(
    character.name,
    `${character.name}, the ${character.personality}. ${character.shortStory} Flat ${formatPrice(styleDetails.flat.price)}. Artisan ${formatPrice(styleDetails.artisan.price)}, including one MX switch.`,
    `/characters/${character.slug}`,
  );
}

export function generateStaticParams() {
  return characters.map((character) => ({ slug: character.slug }));
}

export default async function CharacterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const character = getCharacter(slug);
  if (!character) notFound();

  return <main id="main-content" className="inner-page character-page"><Suspense fallback={null}><CharacterProduct character={character} /></Suspense></main>;
}
