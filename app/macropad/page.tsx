import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MacropadShowcase } from "@/components/MacropadShowcase";
import { getMacropadLaunch } from "@/lib/commerce/launch";
import { formatCents } from "@/lib/commerce/money";
import { macropadPurchasable } from "@/lib/catalog";
import { pageMetadata } from "@/lib/page-meta";

export async function generateMetadata() {
  const launch = await getMacropadLaunch();
  const purchasable = macropadPurchasable(launch);
  return pageMetadata(
    "KAPO Pad",
    purchasable
      ? "Shop the six-key KAPO Pad with an OLED display, rotary knob, USB-C, and a white or black base."
      : "The KAPO Pad is a six-key macropad with an OLED display, rotary knob, and USB-C. Coming soon. Price TBD. Not for sale.",
    "/macropad",
  );
}

const specs = [
  ["06", "keys"], ["3 × 2", "layout"], ["OLED", "display"], ["01", "rotary knob"], ["USB-C", "connection"], ["MX", "compatible"], ["02", "base colors"],
];

export default async function MacropadPage() {
  const launch = await getMacropadLaunch();
  const purchasable = macropadPurchasable(launch);
  return (
    <main id="main-content" className="inner-page macropad-page">
      <section className="macropad-hero editorial-width">
        <div>
          <p className="eyebrow">{purchasable ? "Six keys. Your cast." : "Coming soon"}</p>
          <h1>The KAPO Pad.</h1>
          <p>A customizable mechanical macropad designed to match the KAPO character collection.</p>
          <div className="pad-status"><strong>{purchasable && launch.priceCents !== null ? formatCents(launch.priceCents) : "Price TBD"}</strong><span>{purchasable ? "Available" : "Coming soon"}</span></div>
          <p>{purchasable ? "Choose a base below, then check out when you are ready." : "Release date and pricing have not been announced."}</p>
          <div className="button-row"><Link className="button button-dark" href="#product-preview"><span>Preview the pad</span><ArrowRight aria-hidden="true" /></Link><Link className="text-link" href="/macropad/build"><span>Preview a build</span><ArrowRight aria-hidden="true" /></Link></div>
        </div>
        <div><img src="/products/macropad-white-build.png" alt="White six-key KAPO Pad with artisan characters" /></div>
      </section>

      <section className="base-section editorial-width"><header className="section-heading"><div><p className="eyebrow">01 / Base</p><h2>Pick your base.</h2></div></header><div className="base-grid"><article className="reveal"><img src="/products/macropad-white-build.png" alt="White KAPO Pad" loading="lazy" /><span>White</span></article><article className="reveal"><img src="/products/macropad-black-build.png" alt="Black KAPO Pad" loading="lazy" /><span>Black</span></article></div></section>

      <section id="bare-or-built" className="build-choice editorial-width"><header className="section-heading"><div><p className="eyebrow">02 / Build</p><h2>Bare or built.</h2></div></header><div className="build-choice-grid"><article className="reveal"><img src="/products/macropad-white-bare.png" alt="Bare white KAPO Pad with exposed switches" loading="lazy" /><div><h3>Bare</h3><p>Bring your own caps or build it later.</p></div></article><article className="reveal"><img src="/products/macropad-white-build.png" alt="White KAPO Pad with six artisan keycaps" loading="lazy" /><div><h3>KAPO Build</h3><p>Choose six characters and make it yours.</p></div></article></div></section>

      <section className="technical-section editorial-width"><header className="section-heading"><div><p className="eyebrow">03 / Details</p><h2>Small footprint.<br />Full character.</h2></div></header><div className="technical-grid">{specs.map(([value, label]) => <div className="reveal" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></section>

      <MacropadShowcase purchasable={purchasable} priceCents={launch.priceCents} />

      <section className="wide-cta editorial-width reveal">
        <div className="wide-cta-copy">
          <p className="eyebrow">Exactly six positions</p>
          <h2>Make every<br />key yours.</h2>
          <Link className="button button-dark" href="/macropad/build"><span>{purchasable ? "Build your KAPO Pad" : "Preview a build"}</span><ArrowRight aria-hidden="true" size={17} strokeWidth={1.8} /></Link>
        </div>
        <div className="wide-cta-characters" aria-hidden="true">
          <img src="/products/spore-artisan.png" alt="" />
          <img src="/products/gloop-artisan.png" alt="" />
          <img src="/products/rango-artisan.png" alt="" />
          <img src="/products/orbit-artisan.png" alt="" />
        </div>
      </section>
    </main>
  );
}
