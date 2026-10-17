import { ContactForm } from "@/components/ContactForm";
import { pageMetadata } from "@/lib/page-meta";
import { SUPPORT_EMAIL } from "@/lib/store-facts";

export const metadata = pageMetadata(
  "Contact",
  `Questions about a KAPO character or an order go to ${SUPPORT_EMAIL}.`,
  "/contact",
);

export default function ContactPage() {
  return (
    <main id="main-content" className="inner-page">
      <div className="contact-layout editorial-width">
        <header>
          <p className="eyebrow">Contact</p>
          <h1>Need a hand?</h1>
          <p>Questions about a character, an order, or a damaged delivery are welcome.</p>
          <div className="contact-socials">
            <span>Email</span>
            <strong><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></strong>
          </div>
        </header>
        <ContactForm supportEmail={SUPPORT_EMAIL} />
      </div>
    </main>
  );
}
