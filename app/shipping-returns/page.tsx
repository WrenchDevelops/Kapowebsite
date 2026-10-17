import { pageMetadata } from "@/lib/page-meta";
import { PRODUCTION_DAYS_MAX, PRODUCTION_DAYS_MIN, RETURN_WINDOW_DAYS, SUPPORT_EMAIL } from "@/lib/store-facts";

export const metadata = pageMetadata(
  "Shipping & Returns",
  `KAPO ships within the United States. Customers pay shipping at checkout. Keycaps are made in ${PRODUCTION_DAYS_MIN} to ${PRODUCTION_DAYS_MAX} business days, and unused keycaps can be returned within ${RETURN_WINDOW_DAYS} days of delivery.`,
  "/shipping-returns",
);

const sections = [
  ["Shipping", "KAPO ships to street addresses in the United States. The customer pays shipping. Checkout calculates the price from the destination and the package for that order. There is no free-shipping offer. International shipping is not available."],
  ["Processing time", `After payment is confirmed, keycap orders are made and packed in ${PRODUCTION_DAYS_MIN} to ${PRODUCTION_DAYS_MAX} business days. Checkout shows the production window that applies to the order. Carrier transit is separate and is listed with the shipping option you choose. The KAPO Pad is not in production.`],
  ["Tracking", "When the carrier accepts the package, KAPO emails the tracking details to the address used at checkout."],
  ["Damaged or incorrect orders", `If an order arrives damaged or is not what you ordered, email ${SUPPORT_EMAIL} within ${RETURN_WINDOW_DAYS} days of delivery. Include the order number and clear photos of the item and the packaging. KAPO will replace or refund the affected item.`],
  ["Returns", `Unused keycaps in their original packaging can be returned within ${RETURN_WINDOW_DAYS} days of delivery. Email ${SUPPORT_EMAIL} with the order number to start the return. The customer pays return shipping unless the item arrived damaged or incorrect. Items that show use, or that were damaged after delivery, are not eligible.`],
  ["Custom items", "The KAPO Pad is not for sale. When custom builds are offered, a pad made to the customer's key selection can be returned only if it arrives damaged or does not match the confirmed build."],
  ["Refunds", "Approved refunds go back to the original payment method through Stripe. KAPO sends the refund after a returned item is checked, or right away when an order is canceled before it ships or is confirmed damaged or incorrect. Card issuers usually post the refund within 5 to 10 business days after Stripe sends it. Outbound shipping is refunded when KAPO made the error. It is not refunded for a change-of-mind return."],
];

export default function ShippingReturnsPage() {
  return (
    <main id="main-content" className="inner-page">
      <header className="page-intro editorial-width">
        <p className="eyebrow">Help &amp; policies</p>
        <h1>Shipping &amp; Returns.</h1>
        <p>United States orders, paid shipping, and a {RETURN_WINDOW_DAYS}-day window for unused keycaps. Questions go to {SUPPORT_EMAIL}.</p>
      </header>
      <section className="policy-sections editorial-width">
        {sections.map(([title, copy]) => (
          <article key={title}><h2>{title}</h2><p>{copy}</p></article>
        ))}
      </section>
    </main>
  );
}
