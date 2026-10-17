"use client";

import { useState } from "react";
import { characters, type CharacterSlug, type KeycapStyle } from "@/lib/catalog";
import type { MacropadKeySelection } from "@/lib/cart";
import { formatCents } from "@/lib/commerce/money";
import { useCommerce } from "./CommerceProvider";

const initialKeys: MacropadKeySelection[] = Array.from({ length: 6 }, (_, index) => ({ position: index + 1, character: "none", style: "flat" }));

export function MacropadBuilder({ purchasable, priceCents }: { purchasable: boolean; priceCents: number | null }) {
  const [base, setBase] = useState<"white" | "black">("white");
  const [keys, setKeys] = useState(initialKeys);
  const [activePosition, setActivePosition] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCommerce();

  const updateKey = (position: number, update: Partial<MacropadKeySelection>) => {
    setKeys((current) => current.map((key) => key.position === position ? { ...key, ...update } : key));
  };

  const applyPreset = (preset: "bare" | "flat" | "artisan" | "random") => {
    if (preset === "bare") {
      setKeys(initialKeys);
      return;
    }
    setKeys(Array.from({ length: 6 }, (_, index) => ({
      position: index + 1,
      character: (preset === "random"
        ? characters[Math.floor(Math.random() * characters.length)].slug
        : characters[index].slug) as CharacterSlug,
      style: (preset === "random" ? (Math.random() > 0.5 ? "artisan" : "flat") : preset) as KeycapStyle,
    })));
  };

  const addBuild = () => {
    if (!purchasable || priceCents === null) return;
    addItem({
      id: `macropad-custom-${Date.now()}`,
      productId: "macropad-custom",
      name: "KAPO Pad",
      style: `Custom Build · ${base}`,
      image: `/products/macropad-${base}-${keys.some((key) => key.character !== "none") ? "build" : "bare"}.png`,
      unitPrice: priceCents / 100,
      base,
      configuration: keys,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="builder-layout editorial-width">
      <section className={`builder-preview builder-${base}`} aria-label="Live KAPO Pad preview">
        <div className="builder-device">
          <div className="builder-top"><span className="builder-oled">KAPO / 06</span><span className="builder-knob" /></div>
          <div className="builder-keys">
            {keys.map((key) => {
              const character = characters.find((item) => item.slug === key.character);
              return (
                <button type="button" key={key.position} className={activePosition === key.position ? "active" : ""} onClick={() => setActivePosition(key.position)} aria-label={`Configure position ${key.position}`}>
                  {character ? <img src={key.style === "flat" ? character.flatImage : character.artisanImage} alt={`${character.name} ${key.style}`} /> : <span>{key.position}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <p>Live preview · {base} base</p>
      </section>

      <section className="builder-controls">
        <div className="builder-step">
          <p className="step-label">Step 1</p><h2>Choose base.</h2>
          <div className="base-buttons">{(["white", "black"] as const).map((option) => <button type="button" className={base === option ? "active" : ""} key={option} onClick={() => setBase(option)}>{option}</button>)}</div>
        </div>

        <div className="builder-step">
          <p className="step-label">Step 2</p><h2>Build each key.</h2>
          <div className="position-tabs" role="tablist" aria-label="Key positions">
            {keys.map((key) => <button type="button" role="tab" aria-selected={activePosition === key.position} className={activePosition === key.position ? "active" : ""} key={key.position} onClick={() => setActivePosition(key.position)}>{key.position}</button>)}
          </div>
          {keys.filter((key) => key.position === activePosition).map((key) => (
            <div className="key-controls" key={key.position}>
              <label>Character<select value={key.character} onChange={(event) => updateKey(key.position, { character: event.target.value as CharacterSlug | "none" })}><option value="none">None</option>{characters.map((character) => <option key={character.slug} value={character.slug}>{character.name}</option>)}</select></label>
              <label>Style<select value={key.style} disabled={key.character === "none"} onChange={(event) => updateKey(key.position, { style: event.target.value as KeycapStyle })}><option value="flat">Flat</option><option value="artisan">Artisan</option></select></label>
            </div>
          ))}
          <div className="preset-buttons"><span>Quick presets</span><button type="button" onClick={() => applyPreset("bare")}>Bare</button><button type="button" onClick={() => applyPreset("flat")}>All Flat</button><button type="button" onClick={() => applyPreset("artisan")}>All Artisan</button><button type="button" onClick={() => applyPreset("random")}>Random Crew</button></div>
        </div>

        <div className="builder-step builder-summary">
          <p className="step-label">Step 3</p><h2>Review your six.</h2>
          <ol>{keys.map((key) => { const character = characters.find((item) => item.slug === key.character); return <li key={key.position}><span>Position {key.position}</span><strong>{character ? `${character.name} ${key.style === "flat" ? "Flat" : "Artisan"}` : "None"}</strong></li>; })}</ol>
          <div className="pad-status"><strong>{purchasable && priceCents !== null ? formatCents(priceCents) : "Price TBD"}</strong><span>{purchasable ? "Available" : "Coming soon"}</span></div>
          {purchasable ? <button type="button" className="button button-dark builder-add" onClick={addBuild}>{added ? "Build added to cart" : "Add build to cart"}</button> : <button type="button" className="button button-dark builder-add" disabled>Coming soon</button>}
          {!purchasable && <p className="pending-price">Price TBD. This preview does not place an order.</p>}
        </div>
      </section>
    </div>
  );
}
