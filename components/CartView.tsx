"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { characters, formatPrice } from "@/lib/catalog";
import { useCommerce } from "./CommerceProvider";

export function CartView() {
  const { ready, items, updateQuantity, removeItem } = useCommerce();
  const subtotal = items.reduce((total, item) => total + (item.unitPrice ?? 0) * item.quantity, 0);
  const hasPendingPrice = items.some((item) => item.unitPrice === null);

  if (!ready) {
    return (
      <div className="cart-layout editorial-width" aria-busy="true">
        <section className="cart-items">
          <header>
            <p className="eyebrow">Your cart</p>
            <h1>Your cart</h1>
            <p>Items saved in this browser appear here.</p>
          </header>
        </section>
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="empty-state"><p className="eyebrow">Your cart</p><h1>Nothing here yet.</h1><p>Meet the crew. The KAPO Pad is on the site as a preview.</p><div><Link className="button button-dark" href="/shop">Shop KAPO</Link><Link className="text-link" href="/macropad">See the KAPO Pad</Link></div></div>;
  }

  return (
    <div className="cart-layout editorial-width">
      <section className="cart-items">
        <header><p className="eyebrow">Your cart</p><h1>Ready for the desk.</h1></header>
        {items.map((item) => (
          <article className="cart-row" key={item.id}>
            <img src={item.image} alt="" />
            <div className="cart-row-info"><h2>{item.name}</h2><p>{item.style}</p>{item.configuration && <details><summary>View six-key build</summary><ol>{item.configuration.map((key) => { const character = characters.find((entry) => entry.slug === key.character); const styleLabel = key.style === "flat" ? "Flat" : "Artisan"; return <li key={key.position}><span>Position {key.position}</span><strong>{character ? `${character.name} ${styleLabel}` : "None"}</strong></li>; })}</ol></details>}</div>
            <div className="cart-quantity"><button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label={`Decrease ${item.name} quantity`}><Minus aria-hidden="true" /></button><span>{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label={`Increase ${item.name} quantity`}><Plus aria-hidden="true" /></button></div>
            <strong className="cart-row-price">{item.unitPrice === null ? "Price TBD" : formatPrice(item.unitPrice * item.quantity)}</strong>
            <button className="cart-remove" type="button" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}><Trash2 aria-hidden="true" /></button>
          </article>
        ))}
      </section>

      <aside className="order-summary">
        <p className="eyebrow">Order summary</p>
        <dl><div><dt>Subtotal</dt><dd>{hasPendingPrice && subtotal === 0 ? "Price TBD" : formatPrice(subtotal)}</dd></div>{hasPendingPrice && subtotal > 0 && <div><dt>Unpriced item</dt><dd>Price TBD</dd></div>}<div><dt>Shipping</dt><dd>Calculated at checkout</dd></div><div><dt>Tax</dt><dd>Calculated at checkout</dd></div><div className="summary-total"><dt>Total</dt><dd>{hasPendingPrice ? "Price TBD" : formatPrice(subtotal)}</dd></div></dl>
        {hasPendingPrice ? <button type="button" className="button button-dark checkout-button" disabled>Remove unpriced items to check out</button> : <Link className="button button-dark checkout-button" href="/checkout">Checkout securely</Link>}
        {hasPendingPrice && <p className="summary-note">An item in this cart is not for sale. Remove it to check out the rest.</p>}
        <p className="stripe-note">Secure checkout powered by Stripe. Shipping is paid by the customer.</p>
      </aside>
    </div>
  );
}
