import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getShopUser } from "@/app/chatgpt-auth";
import { OpenSupportButton } from "@/components/OpenSupportButton";
import { formatCents } from "@/lib/commerce/money";
import { PRODUCTION_LABELS, type ProductionStatus } from "@/lib/commerce/status";
import { getCustomerOrder } from "@/lib/commerce/store";

export const dynamic = "force-dynamic";

const STEP_LABELS = ["Payment pending", "Printing", "Packaging", "Shipped", "Delivered"] as const;

export default async function CustomerOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const user = await getShopUser();
  if (!user) redirect("/account");
  const { orderNumber } = await params;
  const order = await loadOrder(orderNumber, user);
  if (!order) notFound();

  const status = PRODUCTION_LABELS[order.productionStatus as ProductionStatus] ?? order.productionStatus;
  const placed = new Date(order.createdAt);
  const placedLabel = `Ordered on ${placed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${placed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  const step = progressIndex(order);
  const pieceCount = order.items.reduce((count, item) => count + item.quantity, 0);
  const awaitingPayment = order.paymentStatus === "pending" || order.productionStatus === "pending_payment";

  return (
    <main id="main-content" className="order-screen">
      <section className="order-block">
        <header className="order-block-head">
          <p className="order-crumb">
            <Link href="/account">Account</Link>
            <span aria-hidden="true">/</span>
            <Link href="/account">Orders</Link>
            <span aria-hidden="true">/</span>
            <span>{order.orderNumber}</span>
          </p>
          <div className="order-screen-title">
            <h1>{order.orderNumber}</h1>
            <span className="order-pill">{status}</span>
          </div>
          <p>{placedLabel}</p>
        </header>

        <ol className="order-steps" aria-label="Order progress">
          {STEP_LABELS.map((label, index) => {
            const state = index < step ? "is-done" : index === step ? "is-current" : "";
            const text = index === 0 && step > 0 ? "Paid" : label;
            return (
              <li key={label} className={state} aria-current={index === step ? "step" : undefined}>
                <StepIcon index={index} />
                <span>{text}</span>
              </li>
            );
          })}
        </ol>

        <ul className="order-items">
          {order.items.map((item) => (
            <li key={`${item.name}-${item.style}`}>
              {item.image ? <img src={item.image} alt="" /> : <span className="order-item-blank" />}
              <span>
                <strong>{item.name}</strong>
                <small>{item.quantity} {item.quantity === 1 ? "piece" : "pieces"} · {itemTag(item.style, item.name)}</small>
              </span>
              <b>{formatCents(item.lineTotalCents, order.currency)}</b>
            </li>
          ))}
        </ul>

        <div className="order-help">
          <span>
            <strong>Need help?</strong>
            <small>Questions about this order go straight to KAPO.</small>
          </span>
          <OpenSupportButton className="order-help-primary" help={`I need help with order ${order.orderNumber}.`}>Contact support</OpenSupportButton>
          <Link href="/account">All orders</Link>
        </div>
      </section>

      <aside className="order-panel">
        <p className="eyebrow">Summary</p>
        <dl className="order-summary-list">
          <div><dt>Subtotal</dt><dd>{formatCents(order.merchandiseSubtotalCents, order.currency)}</dd></div>
          <div><dt>Discount</dt><dd>{formatCents(order.discountCents, order.currency)}</dd></div>
          <div>
            <dt>Shipping</dt>
            <dd>{formatCents(order.shippingCents, order.currency)}{order.serviceName ? ` · ${order.carrier} ${order.serviceName}` : ""}</dd>
          </div>
          <div><dt>Tax</dt><dd>{formatCents(order.taxCents, order.currency)}</dd></div>
          <div className="order-total"><dt>Total</dt><dd>{formatCents(order.totalCents, order.currency)}</dd></div>
          <div><dt>Ship to</dt><dd>{order.address.city}, {order.address.state} {order.address.postalCode}</dd></div>
          <div><dt>Tracking</dt><dd>{order.trackingUrl ? <a href={order.trackingUrl}>{order.trackingNumber}</a> : order.trackingNumber ?? "Not shipped yet"}</dd></div>
        </dl>
        <p className="order-note">KAPO prints after payment. Carrier time starts when it ships.{pieceCount > 1 ? ` ${pieceCount} pieces.` : ""}</p>
        <div className="order-actions">
          {awaitingPayment && <Link className="order-pay" href="/checkout">View or update payment</Link>}
          <OpenSupportButton className="order-cancel" help={`I would like to cancel order ${order.orderNumber}.`}>Cancel order</OpenSupportButton>
        </div>
      </aside>
    </main>
  );
}

function progressIndex(order: { paymentStatus: string; productionStatus: string; shippingStatus: string }) {
  if (order.productionStatus === "delivered" || order.shippingStatus === "delivered") return 4;
  if (order.productionStatus === "shipped" || order.shippingStatus === "shipped" || order.shippingStatus === "in_transit") return 3;
  if (order.productionStatus === "packaging" || order.productionStatus === "ready_to_ship") return 2;
  if (order.productionStatus === "printing" || order.productionStatus === "quality_control" || order.productionStatus === "awaiting_production") return 1;
  if (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded") return 1;
  return 0;
}

function itemTag(style: string | null, name: string) {
  const value = `${style ?? ""} ${name}`.toLowerCase();
  if (value.includes("artisan")) return "Artisan";
  return "Keycap";
}

function StepIcon({ index }: { index: number }) {
  if (index === 0) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>;
  if (index === 1) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17h10M8 17V9h8v8M9 9V7h6v2" /></svg>;
  if (index === 2) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-3 8 3-8 3-8-3zM4 8v8l8 3 8-3V8M12 11v8" /></svg>;
  if (index === 3) return <TruckIcon />;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M8.5 12.2l2.3 2.3 4.7-5" /></svg>;
}
function TruckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" /><circle cx="7" cy="17.5" r="1.5" /><circle cx="17" cy="17.5" r="1.5" /></svg>;
}

async function loadOrder(orderNumber: string, user: { userId: string; email: string }) {
  try {
    return await getCustomerOrder(orderNumber, user);
  } catch {
    return null;
  }
}
