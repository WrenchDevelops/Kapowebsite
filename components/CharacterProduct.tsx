"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import type { Character, KeycapStyle } from "@/lib/catalog";
import { characterImage, formatPrice, styleDetails } from "@/lib/catalog";
import { WishlistButton } from "./WishlistButton";
import { useCommerce } from "./CommerceProvider";

export function CharacterProduct({ character }: { character: Character }) {
  const searchParams = useSearchParams();
  const requestedStyle = searchParams.get("style") === "flat" ? "flat" : "artisan";
  const [style, setStyle] = useState<KeycapStyle>(requestedStyle);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCommerce();
  const detail = styleDetails[style];
  const image = characterImage(character, style);

  useEffect(() => {
    setStyle(requestedStyle);
  }, [requestedStyle, character.slug]);

  const otherCharacters = useMemo(() => {
    const all = ["spore", "gloop", "rango", "brine", "bitz", "orbit", "kobi", "rivet"];
    const start = all.indexOf(character.slug);
    return Array.from({ length: 4 }, (_, index) => all[(start + index + 1) % all.length]);
  }, [character.slug]);

  const addToCart = () => {
    addItem({
      id: `${character.slug}-${style}`,
      productId: `${character.slug}-${style}`,
      name: character.name,
      style: detail.label,
      image,
      unitPrice: detail.price,
      quantity,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <>
      <section className="product-hero editorial-width">
        <div className="product-gallery">
          <div className="product-main-image"><img key={image} src={image} alt={`${character.name} ${detail.label}`} /></div>
          <div className="gallery-selectors" aria-label="Choose product image">
            {(["artisan", "flat"] as KeycapStyle[]).map((option) => (
              <button type="button" key={option} className={style === option ? "active" : ""} onClick={() => setStyle(option)}>
                <img src={characterImage(character, option)} alt="" />
                <span>{option}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="product-purchase">
          <p className="eyebrow">{character.personality}</p>
          <h1>{character.name}</h1>
          <p className="product-story">{character.story}</p>

          <div className="product-option-label"><span>Style</span><strong>{formatPrice(detail.price)}</strong></div>
          <div className="style-selector">
            {(["flat", "artisan"] as KeycapStyle[]).map((option) => (
              <button type="button" key={option} className={style === option ? "active" : ""} onClick={() => setStyle(option)} aria-pressed={style === option}>
                <span>{styleDetails[option].label}</span>
                <strong>{formatPrice(styleDetails[option].price)}</strong>
              </button>
            ))}
          </div>

          <p className="style-description">{detail.short}</p>
          <ul className="clean-feature-list">{detail.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>

          <div className="purchase-row">
            <div className="quantity-control" aria-label="Quantity selector">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity"><Minus aria-hidden="true" /></button>
              <span aria-live="polite">{quantity}</span>
              <button type="button" onClick={() => setQuantity((value) => value + 1)} aria-label="Increase quantity"><Plus aria-hidden="true" /></button>
            </div>
            <button type="button" className="button button-dark add-cart-button" onClick={addToCart}>{added ? "Added to cart" : "Add to cart"}</button>
          </div>
          <WishlistButton key={`${character.slug}-${style}`} productId={`${character.slug}-${style}`} />
        </div>
      </section>

      <dl className="spec-band editorial-width">
        <div><dt>Profile</dt><dd>{style === "flat" ? "Low-profile, for everyday typing" : "Sculpted, taller than a Flat cap"}</dd></div>
        <div><dt>Fit</dt><dd>MX-style switches and standard key spacing</dd></div>
        <div><dt>Included</dt><dd>{style === "flat" ? "Keycap only" : "Keycap and one MX switch"}</dd></div>
        <div><dt>Material</dt><dd>Small-batch 3D-printed plastic</dd></div>
        <div><dt>Care</dt><dd>Dust gently. Avoid heat and harsh cleaners.</dd></div>
      </dl>

      <section className="story-feature editorial-width reveal">
        <div><p className="eyebrow">Character story</p><h2>About {character.name}.</h2><p>{character.backstory}</p></div>
        <div><img src={character.artisanImage} alt={`${character.name} artisan character`} loading="lazy" /></div>
      </section>

      <section className="related-section editorial-width">
        <header className="section-heading"><div><p className="eyebrow">Keep exploring</p><h2>Also in the crew.</h2></div><Link className="text-link" href="/characters"><span>Meet everyone</span><ArrowRight aria-hidden="true" /></Link></header>
        <div className="related-grid">
          {otherCharacters.map((slug) => <RelatedCharacter key={slug} slug={slug} />)}
        </div>
      </section>
    </>
  );
}

function RelatedCharacter({ slug }: { slug: string }) {
  const names: Record<string, string> = { spore: "Spore", gloop: "Gloop", rango: "Rango", brine: "Brine", bitz: "Bitz", orbit: "Orbit", kobi: "Kobi", rivet: "Rivet" };
  return (
    <Link href={`/characters/${slug}`} className="related-character reveal">
      <img src={`/products/${slug}-artisan.png`} alt={`${names[slug]} artisan keycap`} loading="lazy" />
      <span>{names[slug]} <ArrowRight aria-hidden="true" /></span>
    </Link>
  );
}
