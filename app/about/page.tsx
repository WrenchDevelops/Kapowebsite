import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pageMetadata } from "@/lib/page-meta";

export const metadata = pageMetadata(
  "About",
  "KAPO is a small character-driven keycap project. Eight original characters are modeled, printed in small batches, checked, and packed.",
  "/about",
);

const process = [
  ["01", "3D modeling", "Each character begins as a small digital sculpture with a distinct silhouette and personality."],
  ["02", "Printing", "Characters are produced in small batches rather than anonymous mass runs."],
  ["03", "Checking", "Each piece is reviewed before it joins an order."],
  ["04", "Packing", "The finished crew is packed carefully for the trip to a new keyboard."],
];

export default function AboutPage() {
  return (
    <main id="main-content" className="inner-page about-page">
      <section className="about-hero editorial-width"><div><p className="eyebrow">The beginning</p><h1>KAPO started with one little keycap.</h1><p>KAPO is a small character-driven keycap project focused on turning everyday keyboard switches into collectible little characters.</p><p>The first character was Spore, a forest guide made to live on a single switch. The rest of the crew grew from that same idea: original characters, printed in small batches, and meant to be typed on or collected.</p></div><div><img src="/products/spore-artisan.png" alt="Spore artisan keycap" /></div></section>
      <section className="process-section editorial-width"><header className="section-heading"><div><p className="eyebrow">The process</p><h2>Designed small.<br />Made carefully.</h2></div></header><div className="process-grid">{process.map(([number, title, copy]) => <article className="reveal" key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
      <section className="small-batch editorial-width reveal"><div><p className="eyebrow">Small runs</p><h2>Built in small batches.</h2></div><p>Small-batch 3D printing means tiny surface and color variations can occur. Those differences are a normal part of the process and a reminder that each member of the crew came through a real production run.</p></section>
      <section className="wide-cta editorial-width reveal">
        <div className="wide-cta-copy">
          <p className="eyebrow">Pick a path</p>
          <h2>Find your first<br />character.</h2>
          <Link className="button button-dark" href="/characters"><span>Meet the crew</span><ArrowRight aria-hidden="true" size={17} strokeWidth={1.8} /></Link>
        </div>
        <div className="wide-cta-characters" aria-hidden="true">
          <img src="/products/brine-artisan.png" alt="" />
          <img src="/products/bitz-artisan.png" alt="" />
          <img src="/products/kobi-artisan.png" alt="" />
          <img src="/products/rivet-artisan.png" alt="" />
        </div>
      </section>
    </main>
  );
}
