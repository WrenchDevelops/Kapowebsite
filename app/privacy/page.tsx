import { pageMetadata } from "@/lib/page-meta";
import { SUPPORT_EMAIL } from "@/lib/store-facts";

export const metadata = pageMetadata(
  "Privacy",
  "KAPO uses your name, email, phone, and shipping address to fulfill orders. Stripe processes cards, Shippo creates shipments, and order email is sent through Resend. KAPO does not sell personal information.",
  "/privacy",
);

const sections = [
  ["Information collected", "Checkout asks for your name, email, phone, and U.S. shipping address so the order can be made and delivered. The contact form collects your name, email, an optional order number, and your message. Signing in asks for the name and email used at checkout."],
  ["Payments", "Card payments are processed by Stripe. KAPO does not store full card numbers. KAPO keeps the order, the shipping address, the amount, and the Stripe payment reference needed to make, ship, refund, and support the order."],
  ["Shipping and email", "Shippo receives the shipping address to quote rates and buy a label. When a label is purchased, the carrier receives the delivery details. Order, tracking, and refund email is sent with Resend to the checkout email."],
  ["Accounts", "Guest checkout does not require an account. If you sign in, KAPO stores an encrypted session cookie on that browser for 30 days with your name and email, so orders placed with that email can be shown. There is no password. Signing out removes the cookie."],
  ["How information is used", "Order details are used to make and ship the order, send tracking, issue refunds, and answer support questions. A hashed network address may be stored with a shipping quote to limit abuse. KAPO does not sell personal information."],
  ["Contact", `Privacy questions and requests about an order go to ${SUPPORT_EMAIL}. Order records are kept for fulfillment, customer support, and tax records.`],
];

export default function PrivacyPage() {
  return (
    <main id="main-content" className="inner-page">
      <header className="page-intro editorial-width">
        <p className="eyebrow">Policy</p>
        <h1>Privacy.</h1>
        <p>What KAPO collects at checkout, in an account, and through the contact form, and who handles payment and shipping.</p>
      </header>
      <section className="policy-sections editorial-width">
        {sections.map(([title, copy]) => (
          <article key={title}><h2>{title}</h2><p>{copy}</p></article>
        ))}
      </section>
    </main>
  );
}
