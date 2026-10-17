"use client";

import { useState } from "react";
import { formatCents } from "@/lib/commerce/money";
import { useCommerce } from "./CommerceProvider";

export function MacropadShowcase({ purchasable, priceCents }: { purchasable: boolean; priceCents: number | null }) {
  const [base, setBase] = useState<"white" | "black">("white");
  const [build, setBuild] = useState<"bare" | "build">("bare");
  const [added, setAdded] = useState(false);
  const { addItem } = useCommerce();
  const image = `/products/macropad-${base}-${build}.png`;

  const addBare = () => {
    if (!purchasable || priceCents === null) return;
    addItem({
      id: `macropad-bare-${base}`,
      productId: "macropad-bare",
      name: "KAPO Pad",
      style: `Bare · ${base}`,
      image,
      unitPrice: priceCents / 100,
      base,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <section className="macropad-selector editorial-width reveal" id="product-preview">
      <div className="macropad-selector-controls">
        <p className="eyebrow">{purchasable ? "Choose a build" : "Coming soon"}</p>
        <h2>{build === "bare" ? "Bare and ready." : "Six characters, one crew."}</h2>
        <div className="selector-row"><span>Base</span><div>{(["white", "black"] as const).map((option) => <button key={option} type="button" className={base === option ? "active" : ""} onClick={() => setBase(option)}>{option}</button>)}</div></div>
        <div className="selector-row"><span>Build</span><div>{(["bare", "build"] as const).map((option) => <button key={option} type="button" className={build === option ? "active" : ""} onClick={() => setBuild(option)}>{option === "build" ? "KAPO Build" : "Bare"}</button>)}</div></div>
        <div className="pad-status"><strong>{purchasable && priceCents !== null ? formatCents(priceCents) : "Price TBD"}</strong><span>{purchasable ? "Available" : "Coming soon"}</span></div>
        {purchasable && build === "bare" && <button type="button" className="button button-dark" onClick={addBare}>{added ? "Added to cart" : "Add bare pad to cart"}</button>}
        {!purchasable && <button type="button" className="button button-dark" disabled>Coming soon</button>}
        {!purchasable && <p className="pending-price">Price TBD. This preview does not take a preorder or a payment.</p>}
      </div>
      <div className="macropad-selector-image"><img key={image} src={image} alt={`${base} KAPO Pad ${build === "bare" ? "with exposed switches" : "with six artisan keycaps"}`} /></div>
    </section>
  );
}
