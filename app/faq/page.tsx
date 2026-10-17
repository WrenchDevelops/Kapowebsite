import { faqItems } from "@/lib/catalog";
import { pageMetadata } from "@/lib/page-meta";

export const metadata = pageMetadata(
  "FAQ",
  "Fit, MX switches, Flat versus Artisan, small-batch printing, shipping, returns, and the upcoming KAPO Pad.",
  "/faq",
);

export default function FAQPage() {
  return (
    <main id="main-content" className="inner-page">
      <div className="faq-layout editorial-width">
        <header><p className="eyebrow">FAQ</p><h1>Everything you need to know.</h1><p>Short answers about keycaps, the KAPO Pad, shipping, and small-batch production.</p></header>
        <section className="faq-list">{faqItems.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</section>
      </div>
    </main>
  );
}
