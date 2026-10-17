"use client";

import { loadStripe } from "@stripe/stripe-js";
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";
import Link from "next/link";
import { useMemo, useState } from "react";
import { US_STATES } from "@/lib/commerce/address";
import { formatCents } from "@/lib/commerce/money";
import { useCommerce } from "./CommerceProvider";

type Rate = {
  id: string;
  provider: string;
  serviceName: string;
  tierLabel?: string | null;
  detail?: string | null;
  amountCents: number;
  estimatedDays: number | null;
  durationTerms: string;
};

type Quote = {
  quoteId: string;
  expiresAt: string;
  subtotalCents: number;
  handlingFeeCents: number;
  productionDaysMin: number;
  productionDaysMax: number;
  defaultRateId: string | null;
  rates: Rate[];
};

type Summary = {
  merchandiseSubtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
};

const appearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#101113",
    colorText: "#101113",
    colorDanger: "#8d2f2f",
    fontFamily: "Inter, ui-sans-serif, sans-serif",
    borderRadius: "2px",
  },
};

export function CheckoutExperience({ canceled }: { canceled: boolean }) {
  const { ready, items, clearCart } = useCommerce();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [rateId, setRateId] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [clientSecret, setClientSecret] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [textUpdates, setTextUpdates] = useState(false);
  const hasPendingPrice = items.some((item) => item.unitPrice === null);
  const stripePromise = useMemo(() => publishableKey ? loadStripe(publishableKey) : null, [publishableKey]);

  if (!ready) return <div className="cart-layout editorial-width" aria-busy="true" />;
  if (!items.length) {
    return <div className="empty-state"><p className="eyebrow">Checkout</p><h1>Your cart is empty.</h1><Link className="button button-dark" href="/shop">Shop KAPO</Link></div>;
  }

  const quoteRates = async (formData: FormData) => {
    setBusy(true);
    setMessage("");
    setSummary(null);
    setClientSecret("");
    try {
      const response = await fetch("/api/checkout/rates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          companyWebsite: String(formData.get("companyWebsite") ?? ""),
          address: {
            name: formData.get("name"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            line1: formData.get("line1"),
            line2: formData.get("line2"),
            city: formData.get("city"),
            state: formData.get("state"),
            postalCode: formData.get("postalCode"),
            country: "US",
          },
          smsUpdates: formData.get("smsUpdates") === "on",
        }),
      });
      const payload = await response.json() as Quote & { message?: string };
      if (!response.ok) {
        setQuote(null);
        setMessage(payload.message ?? "Shipping rates are unavailable.");
        return;
      }
      setQuote(payload);
      setRateId(payload.defaultRateId ?? payload.rates[0]?.id ?? "");
    } catch {
      setMessage("Shipping rates could not be reached. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const startPayment = async () => {
    if (!quote || !rateId) return;
    setBusy(true);
    setMessage("");
    try {
      const configResponse = await fetch("/api/checkout/config");
      const config = await configResponse.json() as { publishableKey: string | null; message: string | null };
      if (!config.publishableKey) {
        setMessage(config.message ?? "Stripe is not configured yet.");
        return;
      }
      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quoteId: quote.quoteId, rateId, discountCode }),
      });
      const payload = await response.json() as { clientSecret?: string; summary?: Summary; message?: string };
      if (!response.ok || !payload.clientSecret || !payload.summary) {
        setMessage(payload.message ?? "Payment could not be started.");
        return;
      }
      setPublishableKey(config.publishableKey);
      setClientSecret(payload.clientSecret);
      setSummary(payload.summary);
    } catch {
      setMessage("Payment could not be reached. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const selected = quote?.rates.find((rate) => rate.id === rateId) ?? null;

  return (
    <div className="checkout-layout editorial-width">
      <section className="checkout-main">
        <header className="checkout-intro">
          <p className="eyebrow">Checkout</p>
          <h1>Ship it to the desk.</h1>
          <p>Shipping is calculated before payment. KAPO production time is separate from the carrier’s transit time.</p>
        </header>
        {canceled && <p className="checkout-message" role="status">Payment was canceled. Your cart is still here.</p>}
        {hasPendingPrice && <p className="summary-note">The KAPO Pad price is still pending, so this cart cannot check out.</p>}
        <form className="checkout-form" onSubmit={(event) => { event.preventDefault(); void quoteRates(new FormData(event.currentTarget)); }}>
          <div className="checkout-grid">
            <label>Full name<input name="name" autoComplete="name" required disabled={hasPendingPrice} /></label>
            <label>Email<input name="email" type="email" autoComplete="email" required disabled={hasPendingPrice} /></label>
            <div className="checkout-phone">
              <label>
                <span className="field-label">{textUpdates ? "Phone" : "Phone · optional"}</span>
                <input name="phone" autoComplete="tel" inputMode="tel" required={textUpdates} disabled={hasPendingPrice} />
              </label>
              <label className="sms-opt-in">
                <input
                  type="checkbox"
                  name="smsUpdates"
                  checked={textUpdates}
                  disabled={hasPendingPrice}
                  onChange={(event) => {
                    setTextUpdates(event.target.checked);
                    setQuote(null);
                    setClientSecret("");
                    setSummary(null);
                  }}
                />
                <span>Text me updates about this order<small>iMessage or SMS when it’s confirmed, printing, shipped, or delivered.</small></span>
              </label>
            </div>
            <label>Street address<input name="line1" autoComplete="address-line1" required disabled={hasPendingPrice} /></label>
            <label><span className="field-label">Apartment · optional</span><input name="line2" autoComplete="address-line2" disabled={hasPendingPrice} /></label>
            <label>City<input name="city" autoComplete="address-level2" required disabled={hasPendingPrice} /></label>
            <label>State<select name="state" autoComplete="address-level1" required defaultValue="PA" disabled={hasPendingPrice}>{US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
            <label>ZIP code<input name="postalCode" autoComplete="postal-code" inputMode="numeric" required disabled={hasPendingPrice} /></label>
          </div>
          <input className="honeypot" name="companyWebsite" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <button className="button button-dark" type="submit" disabled={busy || hasPendingPrice}>{busy ? "Calculating shipping…" : "Calculate shipping"}</button>
        </form>

        {quote && (
          <fieldset className="rate-list">
            <legend>Shipping options</legend>
            <p className="summary-note">Production: {quote.productionDaysMin}–{quote.productionDaysMax} business days. Carrier transit is listed separately and is not included in that production window. Quotes expire {new Date(quote.expiresAt).toLocaleTimeString()}.</p>
            {quote.rates.map((rate) => (
              <label className="rate-option" key={rate.id}>
                <input type="radio" name="shipping-rate" value={rate.id} checked={rateId === rate.id} onChange={() => { setRateId(rate.id); setClientSecret(""); setSummary(null); }} />
                <span><strong>{rate.tierLabel ?? `${rate.provider} ${rate.serviceName}`}</strong><small>{rate.detail ?? `${rate.provider} ${rate.serviceName}`}</small></span>
                <b>{formatCents(rate.amountCents)}</b>
              </label>
            ))}
            {quote.handlingFeeCents > 0 && <p className="summary-note">Each rate includes a {formatCents(quote.handlingFeeCents)} handling fee.</p>}
          </fieldset>
        )}

        {quote && !clientSecret && (
          <div className="discount-row">
            <label><span className="field-label">Discount code · optional</span><input value={discountCode} onChange={(event) => setDiscountCode(event.target.value)} autoComplete="off" /></label>
            <button className="button button-dark" type="button" onClick={() => void startPayment()} disabled={busy || !selected}>Continue to payment</button>
          </div>
        )}

        {clientSecret && stripePromise && summary && (
          <CheckoutElementsProvider stripe={stripePromise} options={{ clientSecret, elementsOptions: { appearance } }}>
            <PaymentStep summary={summary} onPaid={clearCart} />
          </CheckoutElementsProvider>
        )}
        {message && <p className="checkout-message" role="alert">{message}</p>}
      </section>

      <aside className="order-summary">
        <p className="eyebrow">Order summary</p>
        <ul className="checkout-items">
          {items.map((item) => (
            <li key={item.id}><img src={item.image} alt="" /><span><strong>{item.name}</strong><small>{item.style} · {item.quantity}</small></span></li>
          ))}
        </ul>
        <dl>
          <div><dt>Subtotal</dt><dd>{formatCents(summary?.merchandiseSubtotalCents ?? quote?.subtotalCents ?? items.reduce((total, item) => total + Math.round((item.unitPrice ?? 0) * 100) * item.quantity, 0), summary?.currency ?? "usd")}</dd></div>
          <div><dt>Discount</dt><dd>{summary ? formatCents(summary.discountCents, summary.currency) : "Applied at payment"}</dd></div>
          <div><dt>Shipping</dt><dd>{summary ? formatCents(summary.shippingCents, summary.currency) : selected ? formatCents(selected.amountCents) : "Calculated next"}</dd></div>
          <div><dt>Tax</dt><dd>{summary ? formatCents(summary.taxCents, summary.currency) : "Calculated by Stripe"}</dd></div>
          <div className="summary-total"><dt>Total</dt><dd>{summary ? formatCents(summary.totalCents, summary.currency) : "Confirm at payment"}</dd></div>
        </dl>
        <p className="stripe-note">Customers pay shipping. The label is bought later, when the order is packed.</p>
      </aside>
    </div>
  );
}

function PaymentStep({ summary, onPaid }: { summary: Summary; onPaid: () => void }) {
  const checkout = useCheckoutElements();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (checkout.type === "loading") return <p role="status">Loading secure payment…</p>;
  if (checkout.type === "error") return <p role="alert">{checkout.error.message}</p>;

  return (
    <form className="payment-step" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true);
      setError("");
      const result = await checkout.checkout.confirm({ redirect: "if_required" });
      if (result.type === "error") {
        setError(result.error.message ?? "Payment did not go through.");
        setPending(false);
        return;
      }
      onPaid();
      window.location.assign(`/order-confirmation?session_id=${checkout.checkout.id}`);
    }}>
      <PaymentElement />
      <button className="button button-dark checkout-button" type="submit" disabled={pending}>{pending ? "Confirming payment…" : `Pay ${formatCents(summary.totalCents, summary.currency)}`}</button>
      {error && <p role="alert">{error}</p>}
      <p className="stripe-note">Card, Apple Pay, Google Pay, and other methods enabled on the KAPO Stripe account. The order is confirmed only after Stripe’s webhook.</p>
    </form>
  );
}
