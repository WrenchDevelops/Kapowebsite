import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { characters, formatPrice, styleDetails } from "@/lib/catalog";
import { pageMetadata } from "@/lib/page-meta";

export const metadata = pageMetadata(
  "Characters",
  "Meet all eight KAPO characters. Each one is available as a Flat keycap or a sculpted Artisan keycap.",
  "/characters",
);

export default function CharactersPage() {
  return (
    <main id="main-content" className="inner-page">
      <header className="page-intro editorial-width"><p className="eyebrow">The KAPO crew</p><h1>Meet the characters.</h1><p>Eight little personalities made for your keyboard.</p></header>
      <section className="character-index editorial-width">
        {characters.map((character, index) => (
          <article className="character-index-item reveal" key={character.slug} style={{ "--reveal-delay": `${(index % 4) * 65}ms` } as React.CSSProperties}>
            <Link className="character-index-image" href={`/characters/${character.slug}`}><img src={character.artisanImage} alt={`${character.name} artisan keycap`} loading="lazy" /></Link>
            <div className="character-index-copy"><h2>{character.name}</h2><p className="character-personality">{character.personality}</p><p>{character.shortStory}</p><div><span>Flat {formatPrice(styleDetails.flat.price)}</span><span>Artisan {formatPrice(styleDetails.artisan.price)}</span></div><Link className="text-link" href={`/characters/${character.slug}`}><span>Meet {character.name}</span><ArrowRight aria-hidden="true" /></Link></div>
          </article>
        ))}
      </section>
    </main>
  );
}
