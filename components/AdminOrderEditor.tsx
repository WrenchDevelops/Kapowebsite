"use client";

import { useState } from "react";
import { formatCents } from "@/lib/commerce/money";
import { ADMIN_PRODUCTION_STATUSES, isAdminProductionStatus, PRODUCTION_LABELS, type ProductionStatus } from "@/lib/commerce/status";

type AdminOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  currency: string;
  merchandiseSubtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  refundedCents: number;
  paymentStatus: string;
  productionStatus: string;
  shippingStatus: string;
  shipName: string;
  shipLine1: string;
  shipLine2: string;
  shipCity: string;
  shipState: string;
  shipPostalCode: string;
  shipCountry: string;
  carrier: string | null;
  serviceName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  shippoShipmentId: string | null;
  shippoRateId: string | null;
  createdAt: string;
  updatedAt: string;
  reviewReason: string | null;
  items: { id: string; name: string; quantity: number; lineTotalCents: number }[];
  labels: { id: string; status: string; labelUrl: string | null; amountCents: number | null; trackingNumber: string | null; carrier: string | null; serviceName: string | null; errorMessage: string | null; shippoTransactionId: string | null }[];
  labelAudit: { id: string; action: string; amountCents: number | null; carrier: string | null; serviceName: string | null; detail: string | null; createdAt: string }[];
  safeguards: { maxLabelCents: number; dailyMaxCents: number; heldCents: number; remainingCents: number; spendingDay: string; mode: "unconfigured" | "test" | "live_blocked" | "live" };
  tracking: { id: string; status: string; statusDetails: string; occurredAt: string }[];
  events: { id: string; kind: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }[];
  parcel: { lengthIn: number; widthIn: number; heightIn: number; weightOz: number };
};

export function AdminOrderEditor({ order, dense = false }: { order: AdminOrder; dense?: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [rates, setRates] = useState<{ id: string; provider: string; serviceName: string; carrierAmountCents: number; estimatedDays: number | null }[]>([]);
  const [rateId, setRateId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [clearChecked, setClearChecked] = useState(false);
  const [clearNumber, setClearNumber] = useState("");
  const [safeguards, setSafeguards] = useState(order.safeguards);
  const [parcel, setParcel] = useState(order.parcel);
  const activeLabel = order.labels.find((label) => label.status === "succeeded");
  const openAttempt = order.labels.find((label) => label.status === "pending" || label.status === "uncertain");
  const voidPending = order.labels.find((label) => label.status === "void_requested");
  const selected = rates.find((rate) => rate.id === rateId);
  const selectedBlocked = Boolean(selected && (selected.carrierAmountCents > safeguards.maxLabelCents || selected.carrierAmountCents > safeguards.remainingCents));
  const purchasesOpen = safeguards.mode === "test" || safeguards.mode === "live";

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as { message?: string; code?: string; rates?: typeof rates; safeguards?: typeof safeguards };
      if (!response.ok) {
        setMessage(payload.message ?? "That action failed.");
        if (payload.code === "label_uncertain" || payload.code === "label_blocked") window.location.reload();
        return;
      }
      if (payload.safeguards) setSafeguards(payload.safeguards);
      if (payload.rates) {
        setRates(payload.rates);
        setRateId("");
        setConfirmed(false);
        setMessage("Carrier rates refreshed. Choose a service and approve its exact price.");
        return;
      }
      window.location.reload();
    } catch {
      setMessage("The admin action could not be reached.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-order">
      <section>
        <h2>Fulfillment</h2>
        {!dense && (
          <dl className="admin-facts">
            <div><dt>Payment</dt><dd>{order.paymentStatus}</dd></div>
            <div><dt>Production</dt><dd>{PRODUCTION_LABELS[order.productionStatus as ProductionStatus] ?? order.productionStatus}</dd></div>
            <div><dt>Shipping status</dt><dd>{order.shippingStatus}</dd></div>
            <div><dt>Subtotal</dt><dd>{formatCents(order.merchandiseSubtotalCents, order.currency)}</dd></div>
            <div><dt>Discount</dt><dd>{formatCents(order.discountCents, order.currency)}{order.discountCode ? ` (${order.discountCode})` : ""}</dd></div>
            <div><dt>Shipping charged</dt><dd>{formatCents(order.shippingCents, order.currency)}</dd></div>
            <div><dt>Tax</dt><dd>{formatCents(order.taxCents, order.currency)}</dd></div>
            <div><dt>Total paid</dt><dd>{formatCents(order.totalCents, order.currency)}</dd></div>
            <div><dt>Refunded</dt><dd>{formatCents(order.refundedCents, order.currency)}</dd></div>
            <div><dt>Stripe Checkout</dt><dd>{order.stripeCheckoutSessionId ?? "—"}</dd></div>
            <div><dt>Stripe payment</dt><dd>{order.stripePaymentIntentId ?? "—"}</dd></div>
            <div><dt>Shippo shipment</dt><dd>{order.shippoShipmentId ?? "—"}</dd></div>
            <div><dt>Created</dt><dd>{order.createdAt}</dd></div>
            <div><dt>Updated</dt><dd>{order.updatedAt}</dd></div>
          </dl>
        )}
        {order.reviewReason && <p role="status">{order.reviewReason}</p>}
        <label>Production status
          <select defaultValue={order.productionStatus} onChange={(event) => void send({ action: "production", status: event.target.value })} disabled={busy}>
            {!isAdminProductionStatus(order.productionStatus) && <option value={order.productionStatus}>{PRODUCTION_LABELS[order.productionStatus as ProductionStatus] ?? order.productionStatus}</option>}
            {ADMIN_PRODUCTION_STATUSES.map((status) => <option key={status} value={status}>{PRODUCTION_LABELS[status]}</option>)}
          </select>
        </label>
        <button className="button button-dark" type="button" disabled={busy} onClick={() => void send({ action: "refund" })}>Refund remaining balance</button>
      </section>
      <section>
        <h2>Label</h2>
        <p>{order.shipName}, {order.shipLine1}{order.shipLine2 ? `, ${order.shipLine2}` : ""}, {order.shipCity}, {order.shipState} {order.shipPostalCode}</p>
        <p>Customer paid {formatCents(order.shippingCents, order.currency)} for {order.carrier} {order.serviceName}. The label cost below is the current carrier price, not a new customer charge.</p>
        <div className="safeguard-banner" role="status">
          <strong>{safeguards.mode === "live" ? "Live postage is on" : safeguards.mode === "test" ? "Test mode" : "Live postage is blocked"}</strong>
          <span>
            {safeguards.mode === "unconfigured" && "Shippo is not configured, so KAPO cannot buy postage."}
            {safeguards.mode === "test" && "Approving a label buys test postage only. Stripe, the support bot, and webhooks cannot buy a label."}
            {safeguards.mode === "live_blocked" && "Live purchasing is disabled. KAPO will not buy postage until you explicitly set KAPO_ALLOW_LIVE_LABELS=true."}
            {safeguards.mode === "live" && "Approving a label charges the Shippo billing card. Only this dashboard can do that."}
          </span>
          <span>Maximum {formatCents(safeguards.maxLabelCents)} per label. {formatCents(safeguards.remainingCents)} of {formatCents(safeguards.dailyMaxCents)} left on {safeguards.spendingDay}.</span>
        </div>
        {openAttempt && (
          <div className="safeguard-banner">
            <strong>{openAttempt.status === "uncertain" ? "Purchase outcome unknown" : "Purchase in progress"}</strong>
            <span>{openAttempt.errorMessage ?? "KAPO will not buy another label for this order until this attempt is resolved."}</span>
            <label className="confirm-line"><input type="checkbox" checked={clearChecked} onChange={(event) => setClearChecked(event.target.checked)} /> I checked Shippo and confirmed this attempt did not sell a label.</label>
            <label>Type {order.orderNumber} to clear it
              <input value={clearNumber} onChange={(event) => setClearNumber(event.target.value)} autoComplete="off" />
            </label>
            <button className="button" type="button" disabled={busy || !clearChecked || clearNumber.trim() !== order.orderNumber} onClick={() => void send({ action: "clear_label_attempt", confirmed: true, orderNumber: clearNumber.trim() })}>Clear unfinished attempt</button>
          </div>
        )}
        {voidPending && <p role="status">A label refund is still pending. KAPO will not buy a replacement until Shippo finishes the void.</p>}
        {!openAttempt && !voidPending && !activeLabel && (
          <>
            <div className="checkout-grid">
              <label>Length (in)<input type="number" min="0.5" step="0.1" value={parcel.lengthIn} onChange={(event) => setParcel({ ...parcel, lengthIn: Number(event.target.value) })} /></label>
              <label>Width (in)<input type="number" min="0.5" step="0.1" value={parcel.widthIn} onChange={(event) => setParcel({ ...parcel, widthIn: Number(event.target.value) })} /></label>
              <label>Height (in)<input type="number" min="0.5" step="0.1" value={parcel.heightIn} onChange={(event) => setParcel({ ...parcel, heightIn: Number(event.target.value) })} /></label>
              <label>Weight (oz)<input type="number" min="0.1" step="0.1" value={parcel.weightOz} onChange={(event) => setParcel({ ...parcel, weightOz: Number(event.target.value) })} /></label>
            </div>
            <button className="button button-dark" type="button" disabled={busy || safeguards.mode === "unconfigured"} onClick={() => void send({ action: "refresh_rates", ...parcel })}>Refresh carrier rates</button>
            {rates.length > 0 && (
              <fieldset className="rate-list">
                <legend>Label rates</legend>
                {rates.map((rate) => {
                  const overPrice = rate.carrierAmountCents > safeguards.maxLabelCents;
                  const overDaily = rate.carrierAmountCents > safeguards.remainingCents;
                  const blocked = overPrice || overDaily;
                  return (
                    <label className={blocked ? "rate-option is-blocked" : "rate-option"} key={rate.id}>
                      <input type="radio" name="label-rate" disabled={blocked} checked={rateId === rate.id} onChange={() => { setRateId(rate.id); setConfirmed(false); }} />
                      <span><strong>{rate.provider} {rate.serviceName}</strong><small>{overPrice ? `Above the ${formatCents(safeguards.maxLabelCents)} maximum` : overDaily ? "Above today's remaining limit" : rate.estimatedDays ? `${rate.estimatedDays} business day transit` : "Transit estimate unavailable"}</small></span>
                      <b>{formatCents(rate.carrierAmountCents)}</b>
                    </label>
                  );
                })}
              </fieldset>
            )}
            {selected && (
              <label className="confirm-line">
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                I approve one {selected.provider} {selected.serviceName} label for {formatCents(selected.carrierAmountCents)}.
              </label>
            )}
            <button
              className="button button-dark"
              type="button"
              disabled={busy || !purchasesOpen || !selected || selectedBlocked || !confirmed}
              onClick={() => {
                if (!selected || !confirmed) return;
                void send({ action: "purchase_label", rateId: selected.id, confirmed: true, amountCents: selected.carrierAmountCents, carrier: selected.provider, serviceName: selected.serviceName });
              }}
            >{selected ? `Purchase ${formatCents(selected.carrierAmountCents)} label` : "Purchase label"}</button>
          </>
        )}
        {activeLabel?.labelUrl && <a className="text-link" href={activeLabel.labelUrl} target="_blank" rel="noreferrer">Open label PDF</a>}
        <button className="button" type="button" disabled={busy || order.shippingStatus !== "label_purchased"} onClick={() => void send({ action: "mark_shipped" })}>Mark handed to carrier</button>
        <button className="button" type="button" disabled={busy || !activeLabel} onClick={() => void send({ action: "void_label" })}>Void label</button>
        {order.labelAudit.length > 0 && (
          <>
            <h3>Purchase log</h3>
            <ul className="audit-list">
              {order.labelAudit.map((entry) => (
                <li key={entry.id}>{entry.createdAt} · {entry.action}{entry.carrier ? ` · ${entry.carrier} ${entry.serviceName ?? ""}` : ""}{entry.amountCents != null ? ` · ${formatCents(entry.amountCents)}` : ""}{entry.detail ? ` · ${entry.detail}` : ""}</li>
              ))}
            </ul>
          </>
        )}
        {message && <p role="status">{message}</p>}
      </section>
      {!dense && (
      <section>
        <h2>Tracking</h2>
        {order.trackingNumber ? <p>{order.trackingUrl ? <a href={order.trackingUrl}>{order.trackingNumber}</a> : order.trackingNumber}</p> : <p>No tracking number yet.</p>}
        <ul>{order.tracking.map((event) => <li key={event.id}>{event.occurredAt} · {event.status} · {event.statusDetails}</li>)}</ul>
        <h2>History</h2>
        <ul>{order.events.map((event) => <li key={event.id}>{event.createdAt} · {event.kind} · {event.fromStatus ?? "—"} → {event.toStatus}{event.note ? ` · ${event.note}` : ""}</li>)}</ul>
      </section>
      )}
    </div>
  );
}
