import { pageMetadata } from "@/lib/page-meta";
import { SUPPORT_EMAIL } from "@/lib/store-facts";

export const metadata = pageMetadata(
  "Privacy",
  "KAPO uses your name, email, phone, and shipping address to fulfill orders. Stripe processes cards, Shippo creates shipments, and order email is sent through Resend. KAPO does not sell personal information.",
  "/privacy",
);

const sections = [
  ["Information collected", "Checkout asks for your name, email, phone, and U.S. shipping address so the order can be made and delivered. The support chat collects your email and the messages you send, including a request to a person. KAPO Club uses Clerk to verify your email and manage sign-in. Account profiles, saved products, reward transactions and order ownership are stored with KAPO."],
  ["Payments", "Card payments are processed by Stripe. KAPO does not store full card numbers. KAPO keeps the order, the shipping address, the amount, and the Stripe payment reference needed to make, ship, refund, and support the order."],
  ["Shipping and email", "Shippo receives the shipping address to quote rates and buy a label. When a label is purchased, the carrier receives the delivery details. Order, tracking, and refund email is sent with Resend to the checkout email. Newsletter signup is separate and only happens after you confirm a KAPO news email. You choose product, deal, YouTube, Instagram, and news updates, and you can switch those social posts to a weekly digest. Buying a product or emailing support does not subscribe you."],
  ["Accounts", "Guest checkout does not require an account. KAPO Club uses verified Clerk sessions with expiration, refresh and revocation. Clerk manages email verification, supported sign-in methods and account recovery. Previously issued KAPO email-only cookies no longer grant account access. Orders belong to your verified account; guest orders can be claimed after verifying the purchase email. Signing out ends the Clerk session."],
  ["How information is used", "Order details are used to make and ship the order, send tracking, issue refunds, and answer support questions. Rewards use an auditable transaction history, including redemptions, refund reversals and administrator adjustments. Membership does not subscribe you to marketing. Support chat text is processed by OpenRouter and its configured model provider to generate replies. A hashed network address may be stored with a shipping quote to limit abuse. KAPO does not sell personal information."],
  ["Contact", `Privacy questions and requests about an order go to ${SUPPORT_EMAIL}. Order records are kept for fulfillment, customer support, and tax records.`],
];

export default function PrivacyPage() {
  return (
    <main id="main-content" className="inner-page">
      <header className="page-intro editorial-width">
        <p className="eyebrow">Policy</p>
        <h1>Privacy.</h1>
        <p>What KAPO collects at checkout, in an account, and in the support chat, and who handles payment and shipping.</p>
      </header>
      <section className="policy-sections editorial-width">
        {sections.map(([title, copy]) => (
          <article key={title}><h2>{title}</h2><p>{copy}</p></article>
        ))}
      </section>
    </main>
  );
}
