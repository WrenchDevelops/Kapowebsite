import { pageMetadata } from "@/lib/page-meta";
import { PRODUCTION_DAYS_MAX, PRODUCTION_DAYS_MIN, SUPPORT_EMAIL } from "@/lib/store-facts";

export const metadata = pageMetadata(
  "Terms",
  "KAPO keycap orders are accepted when Stripe confirms payment. Shipping is calculated at checkout for U.S. addresses. The KAPO Pad is a preview and is not for sale.",
  "/terms",
);

const sections = [
  ["Products", "The price and description on the product page, confirmed again at checkout, govern each keycap purchase. Flat keycaps are low-profile and do not include a switch. Artisan keycaps are sculpted and include one MX-compatible switch. The KAPO Pad is a preview. It is not an offer to sell, it does not take a preorder, and its price has not been announced."],
  ["Orders", `An order is accepted when Stripe confirms the payment. KAPO ships within the United States. The customer pays shipping, which is calculated at checkout. Keycaps are made and packed in ${PRODUCTION_DAYS_MIN} to ${PRODUCTION_DAYS_MAX} business days after payment, and checkout shows the window that applies to that order. Carrier transit is extra.`],
  ["Small-batch variation", "KAPO characters are small-batch 3D prints. Tiny surface and color differences can occur. Those differences are part of the process and are not, by themselves, a defect."],
  ["Returns and refunds", `Unused keycaps can be returned as described on the Shipping & Returns page. Refunds go back to the original payment method through Stripe. Email ${SUPPORT_EMAIL} with the order number before sending anything back.`],
  ["Accounts", "An account is optional. A verified KAPO Club account shows owned orders and can securely claim guest orders with the same verified purchase email. Guest checkout still completes a purchase. You are responsible for the email address you enter, because tracking and order access use it."],
  ["Questions", `Questions about an order, a product, or these terms go to ${SUPPORT_EMAIL}.`],
];

export default function TermsPage() {
  return (
    <main id="main-content" className="inner-page">
      <header className="page-intro editorial-width">
        <p className="eyebrow">Policy</p>
        <h1>Terms.</h1>
        <p>The terms that apply when you buy a KAPO keycap. The KAPO Pad remains a preview until its price is announced.</p>
      </header>
      <section className="policy-sections editorial-width">
        {sections.map(([title, copy]) => (
          <article key={title}><h2>{title}</h2><p>{copy}</p></article>
        ))}
      </section>
    </main>
  );
}
